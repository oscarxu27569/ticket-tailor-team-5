const SEARCH_CENTRE_LAT = -27.4975;
const SEARCH_CENTRE_LNG = 153.0137;
const DEFAULT_ZOOM = 15;

let map;
let centreMarker;
let eventMarkers = [];
let loadedEvents = [];

document.addEventListener("DOMContentLoaded", () => {
  initialiseMap();
  bindControls();
  loadEvents();
});

function initialiseMap() {
  map = L.map("map").setView([SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG], DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  centreMarker = L.marker([SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG])
    .addTo(map)
    .bindPopup("Search centre: UQ St Lucia");
}

function bindControls() {
  document.getElementById("search-button").addEventListener("click", loadEvents);
  document.getElementById("reset-button").addEventListener("click", resetFilters);
  document.getElementById("search").addEventListener("input", () => {
    renderEvents(applyTextSearch(loadedEvents));
  });
}

async function loadEvents() {
  setStatus("Loading events...");

  const category = document.getElementById("category").value;
  const radius = document.getElementById("radius").value;

  const params = new URLSearchParams({
    lat: SEARCH_CENTRE_LAT,
    lng: SEARCH_CENTRE_LNG,
    radius: radius
  });

  if (category && category !== "All") {
    params.append("category", category);
  }

  const apiUrl = `/api/v1/events/map?${params.toString()}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const events = await response.json();

    if (!Array.isArray(events)) {
      throw new Error("Map API response must be a JSON array");
    }

    loadedEvents = events;
    renderEvents(applyTextSearch(events));
  } catch (error) {
    console.error(error);
    loadedEvents = [];
    clearEventMarkers();
    renderEventList([]);
    setStatus("Could not load events. The backend API /api/v1/events/map may not be ready yet.");
  }
}

function renderEvents(events) {
  clearEventMarkers();
  renderEventList(events);

  if (events.length === 0) {
    setStatus("No events match the current filters.");
    return;
  }

  const bounds = [];

  for (const event of events) {
    if (!hasValidCoordinates(event)) {
      continue;
    }

    const lat = Number(event.latitude);
    const lng = Number(event.longitude);

    const marker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(createPopupHtml(event));

    eventMarkers.push({ marker, event });
    bounds.push([lat, lng]);
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 16
    });
  }

  setStatus(`${events.length} event(s) displayed.`);
}

function renderEventList(events) {
  const eventList = document.getElementById("event-list");
  eventList.innerHTML = "";

  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "No events found.";
    eventList.appendChild(empty);
    return;
  }

  for (const event of events) {
    const card = document.createElement("article");
    card.className = "event-card";

    const title = document.createElement("h3");
    title.textContent = event.title || "Untitled Event";

    const category = document.createElement("p");
    category.textContent = `Category: ${event.category || "N/A"}`;

    const location = document.createElement("p");
    location.textContent = `Location: ${event.location_name || "N/A"}`;

    const distance = document.createElement("p");
    distance.textContent = `Distance: ${formatDistance(event.distance_km)}`;

    const attendees = document.createElement("p");
    attendees.textContent = `Attendees: ${event.attendee_count ?? 0}`;

    const startTime = document.createElement("p");
    startTime.textContent = `Start: ${formatDateTime(event.start_time)}`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show on map";
    button.addEventListener("click", () => focusEvent(event));

    card.appendChild(title);
    card.appendChild(category);
    card.appendChild(location);
    card.appendChild(distance);
    card.appendChild(attendees);
    card.appendChild(startTime);
    card.appendChild(button);

    eventList.appendChild(card);
  }
}

function focusEvent(event) {
  if (!hasValidCoordinates(event)) {
    setStatus("This event does not have valid coordinates.");
    return;
  }

  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  map.setView([lat, lng], 17);

  const found = eventMarkers.find((item) => item.event.id === event.id);
  if (found) {
    found.marker.openPopup();
  }
}

function clearEventMarkers() {
  for (const item of eventMarkers) {
    map.removeLayer(item.marker);
  }
  eventMarkers = [];
}

function resetFilters() {
  document.getElementById("category").value = "All";
  document.getElementById("radius").value = "2";
  document.getElementById("search").value = "";
  map.setView([SEARCH_CENTRE_LAT, SEARCH_CENTRE_LNG], DEFAULT_ZOOM);
  loadEvents();
}

function applyTextSearch(events) {
  const search = document.getElementById("search").value.trim().toLowerCase();

  if (!search) {
    return events;
  }

  return events.filter((event) => {
    const title = String(event.title || "").toLowerCase();
    const location = String(event.location_name || "").toLowerCase();
    const category = String(event.category || "").toLowerCase();

    return title.includes(search) || location.includes(search) || category.includes(search);
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

  return date.toLocaleString();
}

function setStatus(message) {
  document.getElementById("status-message").textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
