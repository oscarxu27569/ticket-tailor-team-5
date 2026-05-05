import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

const DEFAULT_SEARCH_CENTRE = [-27.4975, 153.0137];
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
  const centreMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const locateControlRef = useRef(null);
  const userLocationRef = useRef(null);
  const isLocatingRef = useRef(false);
  const returnToCurrentLocationRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState("All");
  const [radius, setRadius] = useState("2");
  const [search, setSearch] = useState("");
  const [searchCentre, setSearchCentre] = useState(DEFAULT_SEARCH_CENTRE);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [status, setStatus] = useState("Loading events...");

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    isLocatingRef.current = isLocating;
    setLocateControlLoading(isLocating);
  }, [isLocating]);

  useEffect(() => {
    returnToCurrentLocationRef.current = returnToCurrentLocation;
  });

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
      DEFAULT_SEARCH_CENTRE,
      DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapRef.current);

    centreMarkerRef.current = L.marker(DEFAULT_SEARCH_CENTRE, {
      icon: createCentreIcon()
    })
      .addTo(mapRef.current)
      .bindPopup("Search centre");

    locateControlRef.current = L.control({ position: "topleft" });
    locateControlRef.current.onAdd = () => {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar leaflet-control location-control"
      );
      const button = L.DomUtil.create("button", "", container);
      button.type = "button";
      button.title = "Use current location";
      button.setAttribute("aria-label", "Use current location");
      button.innerHTML = "⌖";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        returnToCurrentLocationRef.current?.();
      });

      return container;
    };
    locateControlRef.current.addTo(mapRef.current);

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setUserLocation(location);
          updateUserMarker(location);
        },
      (error) => {
        setStatus(getLocationErrorMessage(error));
      },
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 10000
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
        mapRef.current?.remove();
        mapRef.current = null;
      };
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const loadEvents = useCallback(async () => {
    setStatus("Loading events...");

    const params = new URLSearchParams({
      lat: String(searchCentre[0]),
      lng: String(searchCentre[1]),
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
  }, [category, radius, searchCentre]);

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
      map.setView(searchCentre, DEFAULT_ZOOM);
      setStatus("No events match the current filters.");
    }
  }, [filteredEvents, searchCentre]);

  useEffect(() => {
    if (!mapRef.current || !centreMarkerRef.current) {
      return;
    }

    centreMarkerRef.current.setLatLng(searchCentre);
  }, [searchCentre]);

  function resetFilters() {
    setCategory("All");
    setRadius("2");
    setSearch("");
  }

  function updateUserMarker(location) {
    if (!mapRef.current) {
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(location, {
        icon: createUserLocationIcon()
      })
        .addTo(mapRef.current)
        .bindPopup("Your current location");
      return;
    }

    userMarkerRef.current.setLatLng(location);
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("Your browser does not support location access.");
      return;
    }

    setIsLocating(true);
    setStatus("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = [
          position.coords.latitude,
          position.coords.longitude
        ];
        setUserLocation(location);
        setSearchCentre(location);
        updateUserMarker(location);
        mapRef.current?.setView(location, 16);
        setStatus("Search centre moved to your current location.");
        setIsLocating(false);
      },
      (error) => {
        setStatus(getLocationErrorMessage(error));
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000
      }
    );
  }

  function returnToCurrentLocation() {
    if (isLocatingRef.current) {
      return;
    }

    if (userLocationRef.current) {
      setSearchCentre(userLocationRef.current);
      mapRef.current?.setView(userLocationRef.current, 16);
      setStatus("Returned to your current location.");
      return;
    }

    useCurrentLocation();
  }

  function setLocateControlLoading(isLoading) {
    const button = locateControlRef.current?.getContainer()?.querySelector("button");
    if (!button) {
      return;
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
    button.title = isLoading ? "Finding current location..." : "Use current location";
    button.setAttribute(
      "aria-label",
      isLoading ? "Finding current location" : "Use current location"
    );
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

function createUserLocationIcon() {
  return L.divIcon({
    className: "user-location-marker",
    html: "<span></span>",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
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

function getLocationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access to use current location.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Current location is unavailable right now.";
  }

  if (error.code === error.TIMEOUT) {
    return "Finding your current location timed out.";
  }

  return "Could not read your current location.";
}
