from datetime import datetime, timezone

from .. import db


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(80), nullable=False, default="Activity")
    location_name = db.Column(db.String(160), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    pricing_type = db.Column(db.String(20), nullable=False, default="free")
    price = db.Column(db.Float, nullable=False, default=0)
    visibility = db.Column(db.String(20), nullable=False, default="public")
    attendee_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    creator_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    creator = db.relationship("User", backref=db.backref("events", lazy=True))
