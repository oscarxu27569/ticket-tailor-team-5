from datetime import datetime, timezone

from .. import db


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140), nullable=False)
    description = db.Column(db.Text)
    location_name = db.Column(db.String(160), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(80), nullable=False)
    visibility = db.Column(db.String(20), nullable=False, default="public")
    price = db.Column(db.Float, nullable=False, default=0.0)
    capacity = db.Column(db.Integer)
    attendee_count = db.Column(db.Integer, nullable=False, default=0)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True))
    club = db.Column(db.String(100))
    organiser_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    public_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    organiser = db.relationship("User", backref="events")

    def to_dict(self, distance_km=None, user=None):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "location_name": self.location_name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "category": self.category,
            "visibility": self.visibility,
            "price": self.price,
            "is_ticketed": self.price > 0,
            "capacity": self.capacity,
            "attendee_count": self.attendee_count,
            "start_time": format_datetime(self.start_time),
            "end_time": format_datetime(self.end_time),
            "club": self.club,
            "organiser_id": self.organiser_id,
            "public_at": format_datetime(self.public_at),
            "created_at": format_datetime(self.created_at),
            "is_organiser": user is not None and self.organiser_id == user.id,
            "is_rsvped": False,
        }

        if user is not None:
            data["is_rsvped"] = any(rsvp.user_id == user.id for rsvp in self.rsvps)

        if distance_km is not None:
            data["distance_km"] = round(distance_km, 3)

        return data


def format_datetime(value):
    if value is None:
        return None

    return value.isoformat()
