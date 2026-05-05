from datetime import datetime, timezone

from .. import db


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"))
    message = db.Column(db.String(240), nullable=False)
    read_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref="notifications")
    event = db.relationship("Event", backref="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "event_id": self.event_id,
            "message": self.message,
            "read_at": format_datetime(self.read_at),
            "created_at": format_datetime(self.created_at),
        }


def format_datetime(value):
    if value is None:
        return None

    return value.isoformat()
