from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app():
    app = Flask(__name__, static_folder="../frontend", static_url_path="")

    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"

    db.init_app(app)

    from .views.auth import auth_bp
    app.register_blueprint(auth_bp)

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

    with app.app_context():
        db.create_all()

    return app