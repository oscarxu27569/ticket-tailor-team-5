from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
import sqlite3

from flask import Blueprint, current_app, jsonify, request

from .. import db
from ..models.event import Event
from .auth import get_current_user


events_bp = Blueprint("events", __name__, url_prefix="/api/v1")

VALID_VISIBILITIES = {"public", "club_only"}


@events_bp.route("/events", methods=["GET"])
def list_events():
    user = get_current_user()
    events = Event.query.order_by(Event.start_time.asc()).all()

    visible_events = [
        event.to_dict()
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

    return jsonify(event.to_dict()), 201


@events_bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    user = get_current_user()
    event = Event.query.get_or_404(event_id)

    if not can_view_event(event, user):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify(event.to_dict()), 200


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

    update_event_fields(event, data)
    db.session.commit()

    return jsonify(event.to_dict()), 200


@events_bp.route("/events/map", methods=["GET"])
def map_events():
    lat = parse_query_float("lat")
    lng = parse_query_float("lng")
    radius = parse_query_float("radius", default=2.0)

    if lat is None or lng is None or radius is None:
        return jsonify({"error": "lat, lng, and radius must be valid numbers"}), 400

    if radius < 0:
        return jsonify({"error": "radius must be greater than or equal to 0"}), 400

    category = request.args.get("category")

    # Prefer the standalone map database when it exists.
    # Put the file at: instance/map.db
    map_db_path = Path(current_app.instance_path) / "map.db"
    if map_db_path.exists():
        events = load_activity_location_events(map_db_path, lat, lng, radius)

        if category and category != "All":
            events = [
                event for event in events
                if event.get("category") == category
            ]

        return jsonify(events), 200

    # Fallback to the original SQLAlchemy Event table if instance/map.db is missing.
    user = get_current_user()
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
        event.to_dict(distance_km=distance_km)
        for distance_km, event in results
    ]), 200


def load_activity_location_events(map_db_path, centre_lat, centre_lng, radius_km):
    """Read events from instance/map.db table user_activity_locations."""
    connection = sqlite3.connect(map_db_path)
    connection.row_factory = sqlite3.Row

    try:
        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(user_activity_locations)").fetchall()
        }

        category_select = "category" if "category" in columns else "'Activity' AS category"

        rows = connection.execute(
            f"""
            SELECT
                id,
                username,
                activity_id,
                activity_name,
                activity_address,
                longitude,
                latitude,
                {category_select},
                created_at,
                updated_at
            FROM user_activity_locations
            ORDER BY created_at ASC, id ASC
            """
        ).fetchall()
    finally:
        connection.close()

    events = []
    for row in rows:
        distance_km = haversine_km(
            centre_lat,
            centre_lng,
            float(row["latitude"]),
            float(row["longitude"]),
        )

        if distance_km > radius_km:
            continue

        events.append({
            "id": row["id"],
            "activity_id": row["activity_id"],
            "title": row["activity_name"],
            "description": f"Created by {row['username']}",
            "location_name": row["activity_address"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "category": row["category"] or "Activity",
            "visibility": "public",
            "price": 0.0,
            "is_ticketed": False,
            "capacity": None,
            "attendee_count": 0,
            "start_time": row["created_at"],
            "end_time": None,
            "club": None,
            "organiser_id": None,
            "organiser_name": row["username"],
            "public_at": row["created_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "distance_km": round(distance_km, 3),
        })

    events.sort(key=lambda item: (item["distance_km"], item["title"]))
    return events


def can_view_event(event, user):
    if event.visibility == "public":
        return True

    if user is None:
        return False

    return event.organiser_id == user.id or (
        event.club is not None and event.club == user.club
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
