import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

const SEARCH_CENTRE = [-27.4975, 153.0137];
const DEFAULT_ZOOM = 15;
const categories = [
  "All",
  "Gaming",
  "Music",
  "Food",
  "Sports",
  "Academic",
  "Career",
  "Culture"
];

export default function MapPage() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState("All");
  const [radius, setRadius] = useState("2");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading events...");

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return events;
    }

    return events.filter((event) => {
      return [event.title, event.location_name, event.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [events, search]);

  useEffect(() => {
    if (mapRef.current || !mapElementRef.current) {
      return;
    }

    mapRef.current = L.map(mapElementRef.current).setView(
      SEARCH_CENTRE,
      DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapRef.current);

    L.marker(SEARCH_CENTRE, {
      icon: createCentreIcon()
    })
      .addTo(mapRef.current)
      .bindPopup("Search centre: UQ St Lucia");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const loadEvents = useCallback(async () => {
    setStatus("Loading events...");

    const params = new URLSearchParams({
      lat: String(SEARCH_CENTRE[0]),
      lng: String(SEARCH_CENTRE[1]),
      radius
    });

    if (category !== "All") {
      params.append("category", category);
    }

    try {
      const response = await fetch(`/api/v1/events/map?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Map API response must be a JSON array");
      }

      setEvents(data);
      setStatus(data.length ? `${data.length} event(s) loaded.` : "No events found.");
    } catch (error) {
      setEvents([]);
      setStatus(error.message);
    }
  }, [category, radius]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    for (const item of markersRef.current) {
      map.removeLayer(item.marker);
    }
    markersRef.current = [];

    const bounds = [];

    for (const event of filteredEvents) {
      if (!hasValidCoordinates(event)) {
        continue;
      }

      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      const marker = L.marker([lat, lng], {
        icon: createEventIcon(event.category)
      })
        .addTo(map)
        .bindPopup(createPopupHtml(event));

      markersRef.current.push({ event, marker });
      bounds.push([lat, lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: 16
      });
      setStatus(`${filteredEvents.length} event(s) displayed.`);
    } else {
      map.setView(SEARCH_CENTRE, DEFAULT_ZOOM);
      setStatus("No events match the current filters.");
    }
  }, [filteredEvents]);

  function resetFilters() {
    setCategory("All");
    setRadius("2");
    setSearch("");
  }

  function focusEvent(event) {
    if (!hasValidCoordinates(event) || !mapRef.current) {
      setStatus("This event does not have valid coordinates.");
      return;
    }

    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    mapRef.current.setView([lat, lng], 17);

    const found = markersRef.current.find((item) => item.event.id === event.id);
    found?.marker.openPopup();
  }

  async function toggleRsvp(event) {
    try {
      const updated = await apiRequest(`/api/v1/events/${event.id}/rsvp`, {
        method: event.is_rsvped ? "DELETE" : "POST"
      });

      setEvents((items) =>
        items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      setStatus(updated.is_rsvped ? "RSVP saved." : "RSVP cancelled.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="map-shell">
      <TopNav />

      <section className="map-toolbar">
        <div>
          <p className="eyebrow">Event discovery</p>
          <h1>Campus map</h1>
        </div>

        <div className="controls">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Radius
            <select value={radius} onChange={(event) => setRadius(event.target.value)}>
              <option value="0.5">500 m</option>
              <option value="1">1 km</option>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
            </select>
          </label>

          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or location"
            />
          </label>

          <button className="primary-button compact-button" type="button" onClick={loadEvents}>
            Search
          </button>
          <button className="secondary-button compact-button" type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      <section className="status-bar">{status}</section>

      <section className="map-layout">
        <div className="map-canvas" ref={mapElementRef} />

        <aside className="event-panel">
          <div className="panel-heading">
            <h2>Events</h2>
            <span>{filteredEvents.length}</span>
          </div>

          <div className="event-list">
            {filteredEvents.length === 0 ? (
              <p className="empty-message">No events found.</p>
            ) : (
              filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onFocus={focusEvent}
                  onRsvp={toggleRsvp}
                />
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function EventCard({ event, onFocus, onRsvp }) {
  return (
    <article className="event-card">
      <div className="event-card-header">
        <span className="category-pill">{event.category || "Event"}</span>
        <span>{formatDistance(event.distance_km)}</span>
      </div>
      <h3>{event.title || "Untitled Event"}</h3>
      <p>{event.location_name || "Location unavailable"}</p>
      <dl>
        <div>
          <dt>Attendees</dt>
          <dd>{event.attendee_count ?? 0}</dd>
        </div>
        <div>
          <dt>Starts</dt>
          <dd>{formatDateTime(event.start_time)}</dd>
        </div>
      </dl>
      <div className="event-card-actions">
        <button type="button" onClick={() => onFocus(event)}>
          Show on map
        </button>
        <button type="button" onClick={() => goTo(`/events/${event.id}`)}>
          Details
        </button>
        <button type="button" onClick={() => onRsvp(event)}>
          {event.is_rsvped ? "Cancel" : "RSVP"}
        </button>
      </div>
    </article>
  );
}

function hasValidCoordinates(event) {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function createEventIcon(category) {
  return L.divIcon({
    className: "event-marker",
    html: `<span>${escapeHtml(String(category || "E").slice(0, 1))}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32]
  });
}

function createCentreIcon() {
  return L.divIcon({
    className: "centre-marker",
    html: "<span></span>",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
}

function createPopupHtml(event) {
  return `
    <div class="popup-content">
      <strong>${escapeHtml(event.title || "Untitled Event")}</strong><br>
      Category: ${escapeHtml(event.category || "N/A")}<br>
      Location: ${escapeHtml(event.location_name || "N/A")}<br>
      Distance: ${escapeHtml(formatDistance(event.distance_km))}<br>
      Attendees: ${escapeHtml(event.attendee_count ?? 0)}<br>
      Start: ${escapeHtml(formatDateTime(event.start_time))}
    </div>
  `;
}

function formatDistance(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return `${number.toFixed(2)} km`;
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
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
