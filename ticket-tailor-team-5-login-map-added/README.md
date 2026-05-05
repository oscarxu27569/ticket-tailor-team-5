# ticket-tailor-team-5
Ticket Tailor is a university social event platform supporting event discovery, RSVP, calendar export, and notifications.

## Local development

This branch uses Flask for the backend API and React + Vite for the frontend.

Start the Flask API:

```bash
poetry install --no-root
poetry run python -B -c "from tickettailor import create_app; app=create_app(); app.run(host='127.0.0.1', port=5001, debug=True)"
```

In another terminal, start the React frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the app at:

```text
http://127.0.0.1:5173/login
```

The React dev server proxies `/api` requests to the Flask API at `http://127.0.0.1:5001`.
