from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from math import radians, sin, cos, sqrt, atan2
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

events = [
    {
        "id": 1,
        "title": "UQ Gaming Night",
        "category": "Gaming",
        "location_name": "UQ Union Complex",
        "latitude": -27.4975,
        "longitude": 153.0137,
    },
    {
        "id": 2,
        "title": "Music Club Meetup",
        "category": "Music",
        "location_name": "UQ Lakes",
        "latitude": -27.4998,
        "longitude": 153.0170,
    },
    {
        "id": 3,
        "title": "Business Society BBQ",
        "category": "Food",
        "location_name": "Great Court",
        "latitude": -27.4970,
        "longitude": 153.0151,
    },
    {
        "id": 4,
        "title": "Football Training",
        "category": "Sports",
        "location_name": "UQ Playing Fields",
        "latitude": -27.4922,
        "longitude": 153.0110,
    },
]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371
    lat1 = radians(lat1)
    lon1 = radians(lon1)
    lat2 = radians(lat2)
    lon2 = radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return r * c


@app.get("/api/events")
def get_events(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(5),
    category: Optional[str] = Query(None),
):
    results = []

    for event in events:
        distance = haversine_km(
            lat,
            lng,
            event["latitude"],
            event["longitude"],
        )

        category_matches = category is None or category == "All" or event["category"] == category

        if distance <= radius and category_matches:
            item = event.copy()
            item["distance_km"] = round(distance, 2)
            results.append(item)

    return results