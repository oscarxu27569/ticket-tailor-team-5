from datetime import datetime, timedelta, timezone

from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(test_config=None):
    app = Flask(__name__, static_folder="../frontend", static_url_path="")

    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    from .views.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .views.events import events_bp
    app.register_blueprint(events_bp)

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "login.html")

    @app.route("/login.html")
    def login_page():
        return send_from_directory(app.static_folder, "login.html")

    @app.route("/register.html")
    def register_page():
        return send_from_directory(app.static_folder, "register.html")

    @app.route("/profile.html")
    def profile_page():
        return send_from_directory(app.static_folder, "profile.html")

    @app.route("/map.html")
    def map_page():
        return send_from_directory(app.static_folder, "map.html")

    with app.app_context():
        db.create_all()
        seed_demo_events()

    return app


def seed_demo_events():
    from .models.event import Event

    if Event.query.count() > 0:
        return

    now = datetime.now(timezone.utc)
    demo_events = [
        Event(
            title="Board Games Night",
            description="Casual tabletop games and snacks for students.",
            location_name="UQ Union Complex",
            latitude=-27.4977,
            longitude=153.0134,
            category="Gaming",
            visibility="public",
            price=0.0,
            capacity=80,
            attendee_count=24,
            start_time=now + timedelta(days=2, hours=3),
            end_time=now + timedelta(days=2, hours=6),
            club="Games Society",
        ),
        Event(
            title="Live Music on the Lawn",
            description="Student bands performing near the Great Court.",
            location_name="UQ Great Court",
            latitude=-27.4972,
            longitude=153.0130,
            category="Music",
            visibility="public",
            price=5.0,
            capacity=200,
            attendee_count=67,
            start_time=now + timedelta(days=4, hours=7),
            end_time=now + timedelta(days=4, hours=10),
            club="Music Society",
        ),
        Event(
            title="Food Truck Lunch",
            description="A rotating lunch market with local vendors.",
            location_name="Campbell Place",
            latitude=-27.4959,
            longitude=153.0149,
            category="Food",
            visibility="public",
            price=0.0,
            capacity=300,
            attendee_count=112,
            start_time=now + timedelta(days=1, hours=4),
            end_time=now + timedelta(days=1, hours=7),
            club="Student Union",
        ),
        Event(
            title="Social Soccer Meetup",
            description="Beginner-friendly five-a-side soccer session.",
            location_name="UQ Synthetic Fields",
            latitude=-27.4928,
            longitude=153.0138,
            category="Sports",
            visibility="public",
            price=3.0,
            capacity=40,
            attendee_count=18,
            start_time=now + timedelta(days=3, hours=5),
            end_time=now + timedelta(days=3, hours=7),
            club="UQ Sports Club",
        ),
        Event(
            title="Study Skills Workshop",
            description="Academic planning and exam preparation strategies.",
            location_name="UQ Library",
            latitude=-27.4966,
            longitude=153.0146,
            category="Academic",
            visibility="public",
            price=0.0,
            capacity=60,
            attendee_count=31,
            start_time=now + timedelta(days=5, hours=2),
            end_time=now + timedelta(days=5, hours=4),
            club="Academic Support",
        ),
        Event(
            title="Graduate Careers Panel",
            description="Recent graduates share internship and job search advice.",
            location_name="Advanced Engineering Building",
            latitude=-27.4995,
            longitude=153.0152,
            category="Career",
            visibility="public",
            price=0.0,
            capacity=120,
            attendee_count=52,
            start_time=now + timedelta(days=6, hours=6),
            end_time=now + timedelta(days=6, hours=8),
            club="Careers Society",
        ),
    ]

    db.session.add_all(demo_events)
    db.session.commit()
