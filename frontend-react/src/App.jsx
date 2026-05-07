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

const eventCategories = categories.filter((item) => item !== "All");

const radiuses = [
  { value: "0.5", label: "500 m" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" }
];

const initialLoginForm = {
  email: "",
  password: ""
};

function createInitialEventForm() {
  return {
    title: "",
    description: "",
    category: "Activity",
    location_name: "",
    latitude: String(SEARCH_CENTRE_LAT),
    longitude: String(SEARCH_CENTRE_LNG),
    start_time: toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
    end_time: "",
    pricing_type: "free",
    price: "",
    visibility: "public"
  };
}

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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [eventForm, setEventForm] = useState(createInitialEventForm);
  const [formMessage, setFormMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
    if (!authToken) {
      setCurrentUser(null);
      return;
    }

    loadProfile(authToken);
  }, [authToken]);

  useEffect(() => {
    loadEvents();
  }, [category, radius, authToken]);

  const filteredEvents = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    if (!text) {
      return events;
    }

    return events.filter((event) => {
      const title = String(event.title || "").toLowerCase();
      const location = String(event.location_name || "").toLowerCase();
      const eventCategory = String(event.category || "").toLowerCase();
      const visibility = String(event.visibility || "").toLowerCase();

      return (
        title.includes(text) ||
        location.includes(text) ||
        eventCategory.includes(text) ||
        visibility.includes(text)
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

  async function loadProfile(token) {
    setIsAuthLoading(true);
    setAuthMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load profile");
      }

      setCurrentUser(data);
    } catch (error) {
      console.error(error);
      localStorage.removeItem("token");
      setAuthToken("");
      setCurrentUser(null);
      setAuthMessage("Session expired. Please sign in again.");
    } finally {
      setIsAuthLoading(false);
    }
  }

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
      const response = await fetch(`${API_BASE_URL}/api/v1/events/map?${params}`, {
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`
            }
          : {}
      });

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

  async function handleLogin(event) {
    event.preventDefault();
    setIsAuthLoading(true);
    setAuthMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();

      if (!response.ok || !data.token) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("token", data.token);
      setAuthToken(data.token);
      setLoginForm(initialLoginForm);
      setAuthMessage("Signed in. You can create events now.");
    } catch (error) {
      console.error(error);
      setAuthMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setAuthToken("");
    setCurrentUser(null);
    setAuthMessage("Signed out.");
  }

  function updateEventForm(field, value) {
    setEventForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "pricing_type" && value === "free" ? { price: "" } : {})
    }));
  }

  async function handleCreateEvent(event) {
    event.preventDefault();

    if (!authToken) {
      setFormMessage("Please sign in before creating an event.");
      return;
    }

    setIsCreating(true);
    setFormMessage("");

    const payload = {
      ...eventForm,
      price: eventForm.pricing_type === "free" ? 0 : Number(eventForm.price)
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create event");
      }

      setEventForm(createInitialEventForm());
      setFormMessage(`Created "${data.title}" as a ${data.visibility} event.`);
      await loadEvents();
    } catch (error) {
      console.error(error);
      setFormMessage(error.message);
    } finally {
      setIsCreating(false);
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
        <div>
          <h1>TicketTailor Event Map</h1>
          <p>Create, price, publish, and discover campus events around UQ.</p>
        </div>

        <AccountPanel
          user={currentUser}
          loginForm={loginForm}
          authMessage={authMessage}
          isLoading={isAuthLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onChangeLoginForm={setLoginForm}
        />
      </header>

      <main>
        <EventCreationForm
          form={eventForm}
          isSignedIn={Boolean(currentUser)}
          isCreating={isCreating}
          message={formMessage}
          categories={eventCategories}
          onChange={updateEventForm}
          onSubmit={handleCreateEvent}
        />

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
              placeholder="Search title, location, category, or visibility"
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

function AccountPanel({
  user,
  loginForm,
  authMessage,
  isLoading,
  onLogin,
  onLogout,
  onChangeLoginForm
}) {
  if (user) {
    return (
      <section className="account-panel" aria-label="Account">
        <div>
          <strong>{user.name || user.email}</strong>
          <span>{user.club || "Logged-in user"}</span>
        </div>
        <button type="button" className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </section>
    );
  }

  return (
    <form className="account-panel login-panel" onSubmit={onLogin}>
      <label>
        Email
        <input
          type="email"
          value={loginForm.email}
          onChange={(event) => onChangeLoginForm({ ...loginForm, email: event.target.value })}
          placeholder="you@example.com"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={loginForm.password}
          onChange={(event) => onChangeLoginForm({ ...loginForm, password: event.target.value })}
          placeholder="Password"
          required
        />
      </label>
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
      {authMessage ? <p>{authMessage}</p> : null}
    </form>
  );
}

function EventCreationForm({
  form,
  isSignedIn,
  isCreating,
  message,
  categories,
  onChange,
  onSubmit
}) {
  const isTicketed = form.pricing_type === "ticketed";

  return (
    <section className="creation-card" aria-label="Create event">
      <div className="creation-intro">
        <span className="eyebrow">Committee tools</span>
        <h2>Initialise an event</h2>
        <p>
          Configure the basics, choose free or ticketed pricing, then decide whether it starts
          public on the map or private to your account.
        </p>
      </div>

      <form className="event-form" onSubmit={onSubmit}>
        <label className="wide-field">
          Event title
          <input
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="e.g. Sunset Music Mixer"
            required
          />
        </label>

        <label>
          Category
          <select value={form.category} onChange={(event) => onChange("category", event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          Visibility
          <select value={form.visibility} onChange={(event) => onChange("visibility", event.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>

        <label className="wide-field">
          Location name
          <input
            value={form.location_name}
            onChange={(event) => onChange("location_name", event.target.value)}
            placeholder="e.g. UQ Union Complex"
            required
          />
        </label>

        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(event) => onChange("latitude", event.target.value)}
            required
          />
        </label>

        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(event) => onChange("longitude", event.target.value)}
            required
          />
        </label>

        <label>
          Start time
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(event) => onChange("start_time", event.target.value)}
            required
          />
        </label>

        <label>
          End time
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(event) => onChange("end_time", event.target.value)}
          />
        </label>

        <label>
          Pricing
          <select value={form.pricing_type} onChange={(event) => onChange("pricing_type", event.target.value)}>
            <option value="free">Free</option>
            <option value="ticketed">Ticketed</option>
          </select>
        </label>

        <label>
          Ticket price
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => onChange("price", event.target.value)}
            placeholder={isTicketed ? "12.00" : "Free events use $0"}
            disabled={!isTicketed}
            required={isTicketed}
          />
        </label>

        <label className="wide-field">
          Description
          <textarea
            value={form.description}
            onChange={(event) => onChange("description", event.target.value)}
            placeholder="Short details for attendees"
            rows="3"
          />
        </label>

        <div className="form-actions wide-field">
          <button type="submit" disabled={!isSignedIn || isCreating}>
            {isCreating ? "Creating..." : "Create event"}
          </button>
          <span>{isSignedIn ? "Any logged-in user can create." : "Sign in to create events."}</span>
        </div>

        {message ? <p className="form-message wide-field">{message}</p> : null}
      </form>
    </section>
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
            <div className="event-badges">
              <span>{event.category || "N/A"}</span>
              <span className={event.visibility === "private" ? "private-badge" : "public-badge"}>
                {formatVisibility(event.visibility)}
              </span>
            </div>
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
      Visibility: ${escapeHtml(formatVisibility(event.visibility))}<br />
      Location: ${escapeHtml(event.location_name || "N/A")}<br />
      Distance: ${escapeHtml(formatDistance(event.distance_km))}<br />
      Price: ${escapeHtml(formatPrice(event.price))}<br />
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

function formatVisibility(value) {
  return value === "private" ? "Private" : "Public";
}

function toDateTimeLocalValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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
