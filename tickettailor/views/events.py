from datetime import datetime
from math import atan2, cos, radians, sin, sqrt

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from .. import db
from ..models.event import Event
from .auth import get_current_user
from ..models.rsvp import RSVP


events_bp = Blueprint("events", __name__, url_prefix="/api/v1/events")

VALID_PRICING_TYPES = {"free", "ticketed"}
VALID_VISIBILITIES = {"public", "private"}


def is_blank(value):
    return value is None or str(value).strip() == ""


def haversine_km(lat1, lon1, lat2, lon2):
    radius_km = 6371

    lat1 = radians(lat1)
    lon1 = radians(lon1)
    lat2 = radians(lat2)
    lon2 = radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return radius_km * c


def parse_datetime(value, field_name):
    if not value:
        raise ValueError(f"Missing {field_name}")

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}") from exc


def parse_float(value, field_name):
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {field_name}") from exc


def serialize_event(event, distance_km=None, user=None):
    item = {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "category": event.category,
        "location_name": event.location_name,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat() if event.end_time else None,
        "pricing_type": event.pricing_type,
        "price": event.price,
        "visibility": event.visibility,
        "attendee_count": event.attendee_count,
        "creator_id": event.creator_id,
        "joined_by_current_user": RSVP.query.filter_by(user_id=user.id, event_id=event.id).first() is not None if user else False,
    }

    if distance_km is not None:
        item["distance_km"] = round(distance_km, 2)

    return item


def visible_events_query(user):
    if user is None:
        return Event.query.filter(Event.visibility == "public")

    return Event.query.filter(
        or_(Event.visibility == "public", Event.creator_id == user.id)
    )


def event_time_conflicts(first_event, second_event):
    first_start = first_event.start_time
    first_end = first_event.end_time or first_event.start_time
    second_start = second_event.start_time
    second_end = second_event.end_time or second_event.start_time

    return first_start < second_end and second_start < first_end


@events_bp.route("", methods=["POST"])
def create_event():
    user = get_current_user()

    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()

    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    required_fields = ["title", "category", "location_name", "latitude", "longitude", "start_time"]
    missing_fields = [field for field in required_fields if is_blank(data.get(field))]
    if missing_fields:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing_fields)}"}), 400

    pricing_type = data.get("pricing_type", "free")
    if pricing_type not in VALID_PRICING_TYPES:
        return jsonify({"error": "pricing_type must be 'free' or 'ticketed'"}), 400

    visibility = data.get("visibility", "public")
    if visibility not in VALID_VISIBILITIES:
        return jsonify({"error": "visibility must be 'public' or 'private'"}), 400

    try:
        latitude = parse_float(data.get("latitude"), "latitude")
        longitude = parse_float(data.get("longitude"), "longitude")
        start_time = parse_datetime(data.get("start_time"), "start_time")
        end_time = parse_datetime(data.get("end_time"), "end_time") if data.get("end_time") else None
        price = parse_float(data.get("price", 0), "price")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return jsonify({"error": "Coordinates are out of range"}), 400

    if end_time and end_time < start_time:
        return jsonify({"error": "end_time must be after start_time"}), 400

    if pricing_type == "free":
        price = 0
    elif price <= 0:
        return jsonify({"error": "Ticketed events require a price greater than 0"}), 400

    event = Event(
        title=data["title"].strip(),
        description=(data.get("description") or "").strip() or None,
        category=data["category"].strip(),
        location_name=data["location_name"].strip(),
        latitude=latitude,
        longitude=longitude,
        start_time=start_time,
        end_time=end_time,
        pricing_type=pricing_type,
        price=price,
        visibility=visibility,
        creator_id=user.id,
    )

    db.session.add(event)
    db.session.commit()

    return jsonify(serialize_event(event, user=user)), 201


@events_bp.route("/map", methods=["GET"])
def get_map_events():
    try:
        lat = parse_float(request.args.get("lat"), "lat")
        lng = parse_float(request.args.get("lng"), "lng")
        radius = parse_float(request.args.get("radius", 5), "radius")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    category = request.args.get("category")
    user = get_current_user()
    query = visible_events_query(user)

    if category and category != "All":
        query = query.filter(Event.category == category)

    results = []
    for event in query.order_by(Event.start_time.asc()).all():
        distance = haversine_km(lat, lng, event.latitude, event.longitude)
        if distance <= radius:
            results.append(serialize_event(event, distance, user=user))

    return jsonify(results), 200

@events_bp.route("/<int:event_id>/rsvp", methods=["POST"])
def join_event(event_id):
    user = get_current_user()

    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    event = Event.query.get(event_id)

    if not event:
        return jsonify({"error": "Event not found"}), 404

    if event.creator_id == user.id:
        return jsonify({"error": "You cannot join your own event"}), 400

    existing_rsvp = RSVP.query.filter_by(
        user_id=user.id,
        event_id=event.id
    ).first()

    if existing_rsvp:
        return jsonify({
            "message": "You have already joined this event",
            "attendee_count": event.attendee_count,
            "joined_by_current_user": True
        }), 200

    joined_rsvps = RSVP.query.filter_by(user_id=user.id).all()
    joined_event_ids = [item.event_id for item in joined_rsvps]
    joined_events = Event.query.filter(Event.id.in_(joined_event_ids)).all() if joined_event_ids else []

    for joined_event in joined_events:
        if event_time_conflicts(event, joined_event):
            return jsonify({
                "error": f"This event conflicts with {joined_event.title}",
                "conflict_event_id": joined_event.id,
                "conflict_event_title": joined_event.title
            }), 409

    rsvp = RSVP(
        user_id=user.id,
        event_id=event.id
    )

    event.attendee_count = (event.attendee_count or 0) + 1

    db.session.add(rsvp)
    db.session.commit()

    return jsonify({
        "message": "Joined event successfully",
        "event_id": event.id,
        "attendee_count": event.attendee_count,
        "joined_by_current_user": True
    }), 201
