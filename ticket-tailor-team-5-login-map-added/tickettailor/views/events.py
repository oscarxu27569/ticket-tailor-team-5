from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from flask import Blueprint, Response, jsonify, request

from .. import db
from ..models.event import Event
from ..models.notification import Notification
from ..models.rsvp import RSVP
from .auth import get_current_user


events_bp = Blueprint("events", __name__, url_prefix="/api/v1")

VALID_VISIBILITIES = {"public", "club_only"}


@events_bp.route("/events", methods=["GET"])
def list_events():
    user = get_current_user()
    activate_due_public_events()
    events = Event.query.order_by(Event.start_time.asc()).all()

    visible_events = [
        event.to_dict(user=user)
        for event in events
        if can_view_event(event, user)
    ]

    return jsonify(visible_events), 200


@events_bp.route("/events", methods=["POST"])
def create_event():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    error = validate_event_payload(data)
    if error:
        return jsonify({"error": error}), 400

    event = Event(
        title=data["title"].strip(),
        description=data.get("description"),
        location_name=data["location_name"].strip(),
        latitude=float(data["latitude"]),
        longitude=float(data["longitude"]),
        category=data["category"].strip(),
        visibility=normalise_visibility(data.get("visibility")),
        price=parse_price(data.get("price")),
        capacity=parse_optional_int(data.get("capacity")),
        start_time=parse_datetime(data["start_time"]),
        end_time=parse_optional_datetime(data.get("end_time")),
        club=data.get("club") or user.club,
        organiser_id=user.id,
        public_at=parse_optional_datetime(data.get("public_at")),
    )

    db.session.add(event)
    db.session.commit()

    return jsonify(event.to_dict(user=user)), 201


@events_bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    user = get_current_user()
    activate_due_public_events()
    event = Event.query.get_or_404(event_id)

    if not can_view_event(event, user):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify(event.to_dict(user=user)), 200


@events_bp.route("/events/<int:event_id>", methods=["PUT"])
def update_event(event_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    event = Event.query.get_or_404(event_id)
    if event.organiser_id != user.id:
        return jsonify({"error": "Only the organiser can update this event"}), 403

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    old_title = event.title
    update_event_fields(event, data)
    notify_attendees(
        event,
        f"{old_title} has been updated. Check the latest event details.",
        exclude_user_id=user.id,
    )
    db.session.commit()

    return jsonify(event.to_dict(user=user)), 200


@events_bp.route("/events/map", methods=["GET"])
def map_events():
    activate_due_public_events()
    lat = parse_query_float("lat")
    lng = parse_query_float("lng")
    radius = parse_query_float("radius", default=2.0)

    if lat is None or lng is None or radius is None:
        return jsonify({"error": "lat, lng, and radius must be valid numbers"}), 400

    if radius < 0:
        return jsonify({"error": "radius must be greater than or equal to 0"}), 400

    user = get_current_user()
    category = request.args.get("category")
    query = Event.query.order_by(Event.start_time.asc())

    if category and category != "All":
        query = query.filter(Event.category == category)

    results = []
    for event in query.all():
        if not can_view_event(event, user):
            continue

        distance_km = haversine_km(lat, lng, event.latitude, event.longitude)
        if distance_km <= radius:
            results.append((distance_km, event))

    results.sort(key=lambda item: (item[0], item[1].start_time))

    return jsonify([
        event.to_dict(distance_km=distance_km, user=user)
        for distance_km, event in results
    ]), 200


@events_bp.route("/events/<int:event_id>/rsvp", methods=["POST"])
def create_rsvp(event_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    event = Event.query.get_or_404(event_id)
    if not can_view_event(event, user):
        return jsonify({"error": "Forbidden"}), 403

    existing_rsvp = RSVP.query.filter_by(user_id=user.id, event_id=event.id).first()
    if existing_rsvp:
        return jsonify(event.to_dict(user=user)), 200

    if event.capacity is not None and event.attendee_count >= event.capacity:
        return jsonify({"error": "This event is already full"}), 400

    db.session.add(RSVP(user_id=user.id, event_id=event.id))
    event.attendee_count += 1
    db.session.commit()

    return jsonify(event.to_dict(user=user)), 201


@events_bp.route("/events/<int:event_id>/rsvp", methods=["DELETE"])
def cancel_rsvp(event_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    event = Event.query.get_or_404(event_id)
    rsvp = RSVP.query.filter_by(user_id=user.id, event_id=event.id).first()
    if not rsvp:
        return jsonify(event.to_dict(user=user)), 200

    db.session.delete(rsvp)
    event.attendee_count = max(0, event.attendee_count - 1)
    db.session.commit()

    return jsonify(event.to_dict(user=user)), 200


@events_bp.route("/events/<int:event_id>/calendar.ics", methods=["GET"])
def event_calendar(event_id):
    user = get_current_user()
    event = Event.query.get_or_404(event_id)

    if not can_view_event(event, user):
        return jsonify({"error": "Forbidden"}), 403

    calendar = build_ics(event)
    return Response(
        calendar,
        mimetype="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=event-{event.id}.ics"
        },
    )


@events_bp.route("/notifications", methods=["GET"])
def list_notifications():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    notifications = (
        Notification.query.filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return jsonify([notification.to_dict() for notification in notifications]), 200


@events_bp.route("/notifications/<int:notification_id>/read", methods=["PUT"])
def mark_notification_read(notification_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    notification = Notification.query.get_or_404(notification_id)
    if notification.user_id != user.id:
        return jsonify({"error": "Forbidden"}), 403

    notification.read_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify(notification.to_dict()), 200


def can_view_event(event, user):
    if event.visibility == "public":
        return True

    if user is None:
        return False

    return event.organiser_id == user.id or (
        event.club is not None and event.club == user.club
    )


def activate_due_public_events():
    now = datetime.now(timezone.utc)
    changed = False
    due_events = Event.query.filter(Event.visibility == "club_only").filter(Event.public_at.isnot(None)).all()

    for event in due_events:
        public_at = ensure_timezone(event.public_at)
        if public_at <= now:
            event.visibility = "public"
            notify_attendees(
                event,
                f"{event.title} is now public and visible to the wider campus.",
            )
            changed = True

    if changed:
        db.session.commit()


def notify_attendees(event, message, exclude_user_id=None):
    attendee_ids = {
        rsvp.user_id
        for rsvp in event.rsvps
        if rsvp.user_id != exclude_user_id
    }

    for user_id in attendee_ids:
        db.session.add(
            Notification(
                user_id=user_id,
                event_id=event.id,
                message=message,
            )
        )


def validate_event_payload(data):
    required_fields = [
        "title",
        "location_name",
        "latitude",
        "longitude",
        "category",
        "start_time",
    ]

    for field in required_fields:
        if data.get(field) in (None, ""):
            return f"Missing {field}"

    if not is_valid_coordinate(data["latitude"], -90, 90):
        return "latitude must be between -90 and 90"

    if not is_valid_coordinate(data["longitude"], -180, 180):
        return "longitude must be between -180 and 180"

    if parse_datetime(data["start_time"]) is None:
        return "start_time must be an ISO date/time"

    if data.get("end_time") and parse_datetime(data["end_time"]) is None:
        return "end_time must be an ISO date/time"

    if data.get("public_at") and parse_datetime(data["public_at"]) is None:
        return "public_at must be an ISO date/time"

    if normalise_visibility(data.get("visibility")) not in VALID_VISIBILITIES:
        return "visibility must be public or club_only"

    if data.get("capacity") not in (None, "") and parse_optional_int(data.get("capacity")) is None:
        return "capacity must be a whole number"

    if parse_price(data.get("price")) is None:
        return "price must be a number"

    return None


def update_event_fields(event, data):
    if "title" in data and data["title"]:
        event.title = data["title"].strip()
    if "description" in data:
        event.description = data["description"]
    if "location_name" in data and data["location_name"]:
        event.location_name = data["location_name"].strip()
    if "latitude" in data and is_valid_coordinate(data["latitude"], -90, 90):
        event.latitude = float(data["latitude"])
    if "longitude" in data and is_valid_coordinate(data["longitude"], -180, 180):
        event.longitude = float(data["longitude"])
    if "category" in data and data["category"]:
        event.category = data["category"].strip()
    if "visibility" in data:
        visibility = normalise_visibility(data["visibility"])
        if visibility in VALID_VISIBILITIES:
            event.visibility = visibility
    if "price" in data:
        price = parse_price(data["price"])
        if price is not None:
            event.price = price
    if "capacity" in data:
        event.capacity = parse_optional_int(data["capacity"])
    if "start_time" in data:
        start_time = parse_datetime(data["start_time"])
        if start_time is not None:
            event.start_time = start_time
    if "end_time" in data:
        event.end_time = parse_optional_datetime(data["end_time"])
    if "club" in data:
        event.club = data["club"]
    if "public_at" in data:
        event.public_at = parse_optional_datetime(data["public_at"])


def parse_query_float(name, default=None):
    value = request.args.get(name)
    if value in (None, ""):
        return default

    try:
        return float(value)
    except ValueError:
        return None


def parse_price(value):
    if value in (None, ""):
        return 0.0

    try:
        price = float(value)
    except (TypeError, ValueError):
        return None

    if price < 0:
        return None

    return price


def parse_optional_int(value):
    if value in (None, ""):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_optional_datetime(value):
    if value in (None, ""):
        return None

    return parse_datetime(value)


def parse_datetime(value):
    if value in (None, ""):
        return None

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def normalise_visibility(value):
    if not value:
        return "public"

    return str(value).strip().lower().replace("-", "_")


def is_valid_coordinate(value, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False

    return minimum <= number <= maximum


def haversine_km(start_lat, start_lng, end_lat, end_lng):
    earth_radius_km = 6371.0
    lat_delta = radians(end_lat - start_lat)
    lng_delta = radians(end_lng - start_lng)

    start_lat = radians(start_lat)
    end_lat = radians(end_lat)

    a = (
        sin(lat_delta / 2) ** 2
        + cos(start_lat) * cos(end_lat) * sin(lng_delta / 2) ** 2
    )
    c = 2 * asin(sqrt(a))

    return earth_radius_km * c


def ensure_timezone(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def build_ics(event):
    start_time = ensure_timezone(event.start_time)
    end_time = ensure_timezone(event.end_time or event.start_time)
    created_at = ensure_timezone(event.created_at)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TicketTailor//Campus Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:tickettailor-event-{event.id}@ticket-tailor.local",
        f"DTSTAMP:{format_ics_datetime(created_at)}",
        f"DTSTART:{format_ics_datetime(start_time)}",
        f"DTEND:{format_ics_datetime(end_time)}",
        f"SUMMARY:{escape_ics(event.title)}",
        f"DESCRIPTION:{escape_ics(event.description or '')}",
        f"LOCATION:{escape_ics(event.location_name)}",
        f"GEO:{event.latitude};{event.longitude}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]

    return "\r\n".join(lines)


def format_ics_datetime(value):
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def escape_ics(value):
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )
