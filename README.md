# ticket-tailor-team-5

Ticket Tailor is a university social event platform supporting event discovery, RSVP, calendar export, and notifications.

## Map feature: React frontend + Flask backend

The map frontend has been rewritten as a React app in:

```text
frontend-react/
  index.html
  package.json
  vite.config.js
  src/
    App.jsx
    main.jsx
    styles.css
```

The React map calls the Flask backend endpoint:

```text
GET /api/v1/events/map?lat=-27.4975&lng=153.0137&radius=2&category=Gaming
```

That endpoint is implemented in:

```text
tickettailor/views/events.py
```

It reads events from the SQLite database through the `Event` model in:

```text
tickettailor/models/event.py
```


## Map database file

The uploaded map database should be placed here:

```text
instance/map.db
```

The `/api/v1/events/map` endpoint now reads from the `user_activity_locations` table in `instance/map.db`. The API converts each database row into an event object for the React map.

Original uploaded file name can be `map (1).db`, but inside the project it should be renamed to:

```text
map.db
```

## Run backend

From the project root:

```bash
poetry install
poetry run flask --app tickettailor run --host 0.0.0.0 --port 5000
```

Test the backend:

```bash
curl "http://127.0.0.1:5000/api/v1/events/map?lat=-27.4975&lng=153.0137&radius=2"
```

## Run React frontend

Open a second terminal:

```bash
cd frontend-react
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

The React app uses the Vite proxy in `frontend-react/vite.config.js`, so `/api/...` requests are forwarded to the Flask backend running on port `5000`.

## What was connected

- React controls category, radius, and text search.
- React fetches real backend data from `/api/v1/events/map`.
- Flask filters events by distance and category.
- Event markers are displayed on the Leaflet/OpenStreetMap map.
- The event list and map markers update when filters change.

## Category support in map.db

`instance/map.db` now includes a `category` column in the `user_activity_locations` table.

Current supported categories in the React dropdown:

```text
All, Music, Study, Workshop, Food, Gaming, Career, Sport, Activity
```

The Flask endpoint reads `category` directly from `map.db`, so you can edit categories in DBeaver and refresh the React page.

Example category values already included in the database:

```text
Music Night -> Music
Study Group -> Study
Coding Workshop -> Workshop
Club BBQ -> Food
Board Game Meetup -> Gaming
Career Talk -> Career
Basketball Meetup / Outdoor Yoga -> Sport
Art Exhibition -> Activity
```
