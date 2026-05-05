from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from .. import db
from ..models.user import User


auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1")


def get_current_user():
    token = request.headers.get("Authorization")

    if not token:
        return None

    if token.startswith("Bearer "):
        token = token.replace("Bearer ", "", 1)

    if not token.startswith("user_"):
        return None

    try:
        user_id = int(token.split("_")[1])
    except ValueError:
        return None

    return User.query.get(user_id)


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json()

    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Missing email or password"}), 400

    existing_user = User.query.filter_by(email=data["email"]).first()
    if existing_user:
        return jsonify({"error": "User already exists"}), 400

    user = User(
        email=data["email"],
        password=generate_password_hash(data["password"]),
        name=data.get("name"),
        description=data.get("description"),
        club=data.get("club")
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User created",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "description": user.description,
            "club": user.club
        }
    }), 201


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()

    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    user = User.query.filter_by(email=data.get("email")).first()

    if not user or not check_password_hash(user.password, data.get("password", "")):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "token": f"user_{user.id}"
    }), 200


@auth_bp.route("/profile", methods=["GET"])
def get_profile():
    user = get_current_user()

    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "description": user.description,
        "club": user.club
    }), 200