import { useEffect, useState } from "react";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

export default function EventDetailPage({ eventId }) {
  const [event, setEvent] = useState(null);
  const [message, setMessage] = useState("Loading event...");

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}`);
      setEvent(data);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function toggleRsvp() {
    if (!event) {
      return;
    }

    try {
      const data = await apiRequest(`/api/v1/events/${event.id}/rsvp`, {
        method: event.is_rsvped ? "DELETE" : "POST"
      });
      setEvent(data);
      setMessage(event.is_rsvped ? "RSVP cancelled." : "You are on the attendee list.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="app-shell">
      <TopNav />
      <section className="content-band">
        <article className="detail-panel">
          <button className="text-button" type="button" onClick={() => goTo("/map")}>
            Back to map
          </button>

          {message && <p className="form-message">{message}</p>}

          {event && (
            <>
              <header className="detail-header">
                <span className="category-pill">{event.category}</span>
                <h1>{event.title}</h1>
                <p>{event.description || "No description yet."}</p>
              </header>

              <dl className="detail-grid">
                <div>
                  <dt>Location</dt>
                  <dd>{event.location_name}</dd>
                </div>
                <div>
                  <dt>Starts</dt>
                  <dd>{formatDateTime(event.start_time)}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{event.price > 0 ? `$${event.price.toFixed(2)}` : "Free"}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>{event.visibility === "club_only" ? "Club only" : "Public"}</dd>
                </div>
                <div>
                  <dt>Attendees</dt>
                  <dd>
                    {event.attendee_count}
                    {event.capacity ? ` / ${event.capacity}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Club</dt>
                  <dd>{event.club || "Not set"}</dd>
                </div>
              </dl>

              <div className="button-row">
                <button className="primary-button" type="button" onClick={toggleRsvp}>
                  {event.is_rsvped ? "Cancel RSVP" : "RSVP"}
                </button>
                <a
                  className="secondary-link-button"
                  href={`/api/v1/events/${event.id}/calendar.ics`}
                >
                  Add to calendar
                </a>
                {event.is_organiser && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => goTo(`/events/${event.id}/edit`)}
                  >
                    Edit event
                  </button>
                )}
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
