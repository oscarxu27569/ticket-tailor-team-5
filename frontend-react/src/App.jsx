import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

const SEARCH_CENTRE_LAT = -27.4975;
const SEARCH_CENTRE_LNG = 153.0137;
const DEFAULT_ZOOM = 15;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const categories = [
  "All",
  "Music",
  "Study",
  "Workshop",
  "Food",
  "Gaming",
  "Career",
  "Sport",
  "Activity"
];

const radiuses = [
  { value: "0.5", label: "500 m" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" }
];

function App() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [category, setCategory] = useState("All");
  const [radius, setRadius] = useState("2");
  const [searchText, setSearchText] = useState("");
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("Loading events...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mapRef.current || !mapElementRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current).setView(
      [SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG],
      DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    L.marker([SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG])
      .addTo(map)
      .bindPopup("Search centre: UQ St Lucia");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadEvents();
  }, [category, radius]);

  const filteredEvents = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    if (!text) {
      return events;
    }

    return events.filter((event) => {
      const title = String(event.title || "").toLowerCase();
      const location = String(event.location_name || "").toLowerCase();
      const eventCategory = String(event.category || "").toLowerCase();

      return (
        title.includes(text) ||
        location.includes(text) ||
        eventCategory.includes(text)
      );
    });
  }, [events, searchText]);

  useEffect(() => {
    renderMarkers(filteredEvents);

    if (filteredEvents.length === 0 && !isLoading) {
      setStatus("No events match the current filters.");
    } else if (!isLoading) {
      setStatus(`${filteredEvents.length} event(s) displayed.`);
    }
  }, [filteredEvents, isLoading]);

  async function loadEvents() {
    setIsLoading(true);
    setStatus("Loading events...");

    const params = new URLSearchParams({
      lat: String(SEARCH_CENTRE_LAT),
      lng: String(SEARCH_CENTRE_LNG),
      radius
    });

    if (category !== "All") {
      params.append("category", category);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/events/map?${params}`);

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Backend response is not an array");
      }

      setEvents(data);
      setStatus(`${data.length} event(s) loaded from backend.`);
    } catch (error) {
      console.error(error);
      setEvents([]);
      clearMarkers();
      setStatus("Could not load events. Check that Flask is running and /api/v1/events/map works.");
    } finally {
      setIsLoading(false);
    }
  }

  function renderMarkers(items) {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    clearMarkers();
    const bounds = [];

    for (const event of items) {
      if (!hasValidCoordinates(event)) {
        continue;
      }

      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      const marker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(createPopupHtml(event));

      markersRef.current.push({ marker, event });
      bounds.push([lat, lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 16
      });
    }
  }

  function clearMarkers() {
    const map = mapRef.current;
    if (!map) {
      markersRef.current = [];
      return;
    }

    for (const item of markersRef.current) {
      map.removeLayer(item.marker);
    }

    markersRef.current = [];
  }

  function focusEvent(event) {
    if (!mapRef.current || !hasValidCoordinates(event)) {
      setStatus("This event does not have valid coordinates.");
      return;
    }

    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    mapRef.current.setView([lat, lng], 17);

    const found = markersRef.current.find((item) => item.event.id === event.id);
    if (found) {
      found.marker.openPopup();
    }
  }

  function resetFilters() {
    setCategory("All");
    setRadius("2");
    setSearchText("");
    mapRef.current?.setView([SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG], DEFAULT_ZOOM);
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>TicketTailor Event Map</h1>
        <p>Nearby activities loaded from the map database.</p>
      </header>

      <main>
        <section className="controls" aria-label="Event map filters">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Radius
            <select value={radius} onChange={(event) => setRadius(event.target.value)}>
              {radiuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Search
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search title, location, or category"
            />
          </label>

          <button type="button" onClick={loadEvents} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </button>
          <button type="button" className="secondary-button" onClick={resetFilters}>
            Reset
          </button>
        </section>

        <section className="status-bar">
          <span>{status}</span>
        </section>

        <section className="map-layout">
          <div ref={mapElementRef} className="map" aria-label="Event map" />

          <aside className="event-panel">
            <h2>Events</h2>
            <EventList events={filteredEvents} onFocusEvent={focusEvent} />
          </aside>
        </section>
      </main>
    </div>
  );
}

function EventList({ events, onFocusEvent }) {
  if (events.length === 0) {
    return <p className="empty-message">No events found.</p>;
  }

  return (
    <div className="event-list">
      {events.map((event) => (
        <article className="event-card" key={event.id}>
          <div className="event-card-header">
            <h3>{event.title || "Untitled Event"}</h3>
            <span>{event.category || "N/A"}</span>
          </div>

          <p><strong>Location:</strong> {event.location_name || "N/A"}</p>
          <p><strong>Distance:</strong> {formatDistance(event.distance_km)}</p>
          <p><strong>Attendees:</strong> {event.attendee_count ?? 0}</p>
          <p><strong>Start:</strong> {formatDateTime(event.start_time)}</p>
          <p><strong>Price:</strong> {formatPrice(event.price)}</p>

          <button type="button" onClick={() => onFocusEvent(event)}>
            Show on map
          </button>
        </article>
      ))}
    </div>
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

function createPopupHtml(event) {
  return `
    <div class="popup-content">
      <strong>${escapeHtml(event.title || "Untitled Event")}</strong><br />
      Category: ${escapeHtml(event.category || "N/A")}<br />
      Location: ${escapeHtml(event.location_name || "N/A")}<br />
      Distance: ${escapeHtml(formatDistance(event.distance_km))}<br />
      Attendees: ${escapeHtml(event.attendee_count ?? 0)}<br />
      Start: ${escapeHtml(formatDateTime(event.start_time))}
    </div>
  `;
}

function formatDistance(value) {
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

  return date.toLocaleString();
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return "Free";
  }

  return `$${number.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default App;
