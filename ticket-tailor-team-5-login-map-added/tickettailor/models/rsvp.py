from datetime import datetime, timezone

from .. import db


class RSVP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref="rsvps")
    event = db.relationship("Event", backref=db.backref("rsvps", cascade="all, delete-orphan"))

    __table_args__ = (
        db.UniqueConstraint("user_id", "event_id", name="unique_user_event_rsvp"),
    )
