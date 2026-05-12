import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import LoginPage from "./LoginPage.jsx";
import RegisterPage from "./RegisterPage.jsx";


const SEARCH_CENTRE_LAT = -27.4975;
const SEARCH_CENTRE_LNG = 153.0137;
const DEFAULT_ZOOM = 15;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const EVENTS_PER_PAGE = 6;

const UQ_LOCATIONS = [
  {
    name: "UQ Union Complex",
    latitude: -27.4975,
    longitude: 153.0137
  },
  {
    name: "Great Court",
    latitude: -27.4971,
    longitude: 153.0132
  },
  {
    name: "Central Library",
    latitude: -27.4979,
    longitude: 153.0135
  },
  {
    name: "UQ Lakes Bus Station",
    latitude: -27.4992,
    longitude: 153.0173
  },
  {
    name: "Schonell Theatre",
    latitude: -27.4978,
    longitude: 153.0121
  },
  {
    name: "UQ Sport Fitness Centre",
    latitude: -27.4939,
    longitude: 153.0151
  },
  {
    name: "Advanced Engineering Building",
    latitude: -27.5001,
    longitude: 153.0144
  },
  {
    name: "Sir Llew Edwards Building",
    latitude: -27.4962,
    longitude: 153.0139
  },
  {
    name: "Global Change Institute",
    latitude: -27.4993,
    longitude: 153.0151
  },
  {
    name: "UQ Art Museum",
    latitude: -27.4974,
    longitude: 153.0124
  }
];

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

const initialRegisterForm = {
  email: "",
  password: ""
};

function createInitialEventForm() {
  const defaultLocation = UQ_LOCATIONS[0];

  return {
    title: "",
    description: "",
    category: "Activity",
    location_name: defaultLocation.name,
    latitude: String(defaultLocation.latitude),
    longitude: String(defaultLocation.longitude),
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
  const [authView, setAuthView] = useState("login");
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [registerMessage, setRegisterMessage] = useState("");
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [isRegisterComplete, setIsRegisterComplete] = useState(false);
  const [eventForm, setEventForm] = useState(createInitialEventForm);
  const [formMessage, setFormMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePage, setActivePage] = useState("profile");
  const [editingEvent, setEditingEvent] = useState(null);
  const [createdEventIds, setCreatedEventIds] = useState([]);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [profileDraft, setProfileDraft] = useState({
    name: "",
    club: "",
    description: ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    if (!currentUser || activePage !== "map" || mapRef.current || !mapElementRef.current) {
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


    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [currentUser, activePage]);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setCreatedEventIds([]);
      return;
    }

    loadProfile(authToken);
  }, [authToken]);

  useEffect(() => {
    setCreatedEventIds(loadCreatedEventIdsForUser(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setEvents([]);
      setStatus("Loading events...");
      return;
    }

    loadEvents();
  }, [category, radius, authToken, currentUser]);

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
    if (activePage === "map") {
      renderMarkers(filteredEvents);
    }

    if (filteredEvents.length === 0 && !isLoading) {
      setStatus("No events match the current filters.");
    } else if (!isLoading) {
      setStatus(`${filteredEvents.length} event(s) displayed.`);
    }
  }, [filteredEvents, isLoading, activePage]);

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

      const savedProfile = JSON.parse(
        localStorage.getItem(`profile:${data.email}`) || "{}"
      );

      const mergedProfile = {
        ...data,
        name: savedProfile.name ?? data.name ?? "",
        club: savedProfile.club ?? data.club ?? "",
        description: savedProfile.description ?? data.description ?? ""
      };

      setCurrentUser(mergedProfile);
      setProfileDraft({
        name: mergedProfile.name || "",
        club: mergedProfile.club || "",
        description: mergedProfile.description || ""
      });
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
      setAuthMessage("");
    } catch (error) {
      console.error(error);
      setAuthMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setIsRegisterLoading(true);
    setRegisterMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(registerForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create account");
      }

      setLoginForm({
        email: registerForm.email,
        password: ""
      });
      setRegisterForm(initialRegisterForm);
      setRegisterMessage("Your account has been created.");
      setIsRegisterComplete(true);
    } catch (error) {
      console.error(error);
      setRegisterMessage(error.message);
    } finally {
      setIsRegisterLoading(false);
    }
  }

  function showRegisterPage() {
    setAuthView("register");
    setAuthMessage("");
    setRegisterMessage("");
    setIsRegisterComplete(false);
  }

  function showLoginPage() {
    setAuthView("login");
    setAuthMessage("");
    setRegisterMessage("");
    setIsRegisterComplete(false);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setAuthToken("");
    setCurrentUser(null);
    setAuthMessage("Signed out.");
  }

  function updateEventForm(field, value) {
    setEventForm((current) => {
      if (field === "location_name") {
        const selectedLocation = UQ_LOCATIONS.find((location) => location.name === value);

        if (selectedLocation) {
          return {
            ...current,
            location_name: selectedLocation.name,
            latitude: String(selectedLocation.latitude),
            longitude: String(selectedLocation.longitude)
          };
        }
      }

      return {
        ...current,
        [field]: value,
        ...(field === "pricing_type" && value === "free" ? { price: "" } : {})
      };
    });
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

      if (data.id !== undefined && data.id !== null) {
        setCreatedEventIds((current) => {
          const next = Array.from(new Set([...current, data.id]));
          localStorage.setItem(getCreatedEventStorageKey(currentUser), JSON.stringify(next));
          return next;
        });
      }

      setEventForm(createInitialEventForm());
      setFormMessage(`Created "${data.title}" as a ${data.visibility} event.`);
      setIsCreateModalOpen(false);
      await loadEvents();
    } catch (error) {
      console.error(error);
      setFormMessage(error.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinEvent(event) {
    if (!authToken) {
      setStatus("Please sign in before joining an event.");
      return;
    }

    if (isUserCreatedEvent(event, currentUser, createdEventIds)) {
      setStatus("You cannot join your own event.");
      return;
    }

    if (isUserJoinedEvent(event, currentUser)) {
      setStatus(`You have already joined "${event.title || "this event"}".`);
      return;
    }

    const conflict = findTimeConflict(event, joinedEvents);
    if (conflict) {
      setStatus(`Cannot join "${event.title || "this event"}" because it conflicts with "${conflict.title || "another joined event"}".`);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/events/${event.id}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        }
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Join API was not found. Restart Flask and make sure POST /api/v1/events/<id>/rsvp exists in tickettailor/views/events.py.");
        }

        throw new Error(data.error || data.message || "Could not join event");
      }

      setEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? {
                ...item,
                attendee_count: data.attendee_count ?? Number(item.attendee_count || 0) + 1,
                joined_by_current_user: true,
                is_joined: true
              }
            : item
        )
      );

      setStatus(`Joined "${event.title}".`);
      await loadEvents();
    } catch (error) {
      console.error(error);
      setStatus(error.message);
    }
  }

  const joinedEvents = useMemo(() => {
    return filteredEvents.filter((event) => isUserJoinedEvent(event, currentUser));
  }, [filteredEvents, currentUser]);

  const createdEvents = useMemo(() => {
    return filteredEvents.filter((event) => isUserCreatedEvent(event, currentUser, createdEventIds));
  }, [filteredEvents, currentUser, createdEventIds]);

  function openEditEvent(event) {
    setEditingEvent(event);
    setEventForm({
      title: event.title || "",
      description: event.description || "",
      category: event.category || "Activity",
      location_name: event.location_name || UQ_LOCATIONS[0].name,
      latitude: String(event.latitude || UQ_LOCATIONS[0].latitude),
      longitude: String(event.longitude || UQ_LOCATIONS[0].longitude),
      start_time: toDateTimeLocalValueFromApi(event.start_time),
      end_time: toDateTimeLocalValueFromApi(event.end_time),
      pricing_type: Number(event.price) > 0 ? "ticketed" : "free",
      price: Number(event.price) > 0 ? String(event.price) : "",
      visibility: event.visibility || "public"
    });
    setFormMessage("");
    setIsCreateModalOpen(false);
    setActivePage("created");
  }

  function closeEditEvent() {
    setEditingEvent(null);
    setEventForm(createInitialEventForm());
    setFormMessage("");
  }

  async function handleUpdateEvent(event) {
    event.preventDefault();

    if (!authToken || !editingEvent) {
      setFormMessage("Please sign in before editing an event.");
      return;
    }

    if (!isUserCreatedEvent(editingEvent, currentUser, createdEventIds)) {
      setFormMessage("You can only edit events you created.");
      return;
    }

    setIsCreating(true);
    setFormMessage("");

    const payload = {
      ...eventForm,
      price: eventForm.pricing_type === "free" ? 0 : Number(eventForm.price)
    };

    try {
      let response = await fetch(`${API_BASE_URL}/api/v1/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${API_BASE_URL}/api/v1/events/${editingEvent.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        throw new Error(data.error || "Backend does not support editing this event yet.");
      }

      const data = await response.json();
      setEvents((current) =>
        current.map((item) => (item.id === editingEvent.id ? { ...item, ...data, ...payload } : item))
      );
      setFormMessage(`Updated "${payload.title}".`);
      setEditingEvent(null);
      setEventForm(createInitialEventForm());
      await loadEvents();
    } catch (error) {
      console.error(error);
      setEvents((current) =>
        current.map((item) => (item.id === editingEvent.id ? { ...item, ...payload } : item))
      );
      setFormMessage(`${error.message} The page has still been updated locally.`);
      setEditingEvent(null);
      setEventForm(createInitialEventForm());
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

  function goToPreviousWeek() {
    setCalendarWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() - 7);
      return getStartOfWeek(next);
    });
  }

  function goToNextWeek() {
    setCalendarWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + 7);
      return getStartOfWeek(next);
    });
  }

  function goToCurrentWeek() {
    setCalendarWeekStart(getStartOfWeek(new Date()));
  }

  function validateProfileDraft() {
    const name = profileDraft.name.trim();
    const club = profileDraft.club.trim();
    const description = profileDraft.description.trim();

    if (name && (name.length < 2 || name.length > 50)) {
      return "Name must be between 2 and 50 characters.";
    }

    if (name && !/^[a-zA-Z0-9\s.'_-]+$/.test(name)) {
      return "Name can only contain letters, numbers, spaces, dots, apostrophes, underscores, or hyphens.";
    }

    if (club.length > 80) {
      return "Club must be 80 characters or fewer.";
    }

    if (club && !/^[a-zA-Z0-9\s&.'_-]+$/.test(club)) {
      return "Club can only contain letters, numbers, spaces, &, dots, apostrophes, underscores, or hyphens.";
    }

    if (description.length > 300) {
      return "Description must be 300 characters or fewer.";
    }

    return "";
  }

  function handleProfileDraftChange(field, value) {
    setProfileDraft((current) => ({
      ...current,
      [field]: value
    }));
    setProfileMessage("");
  }

  function startProfileEdit() {
    setProfileDraft({
      name: currentUser?.name || "",
      club: currentUser?.club || "",
      description: currentUser?.description || ""
    });
    setProfileMessage("");
    setIsEditingProfile(true);
  }

  function cancelProfileEdit() {
    setProfileDraft({
      name: currentUser?.name || "",
      club: currentUser?.club || "",
      description: currentUser?.description || ""
    });
    setProfileMessage("");
    setIsEditingProfile(false);
  }

  function handleSaveProfile() {
    const error = validateProfileDraft();

    if (error) {
      setProfileMessage(error);
      return;
    }

    const nextProfile = {
      ...currentUser,
      name: profileDraft.name.trim(),
      club: profileDraft.club.trim(),
      description: profileDraft.description.trim()
    };

    setCurrentUser(nextProfile);

    if (nextProfile.email) {
      localStorage.setItem(
        `profile:${nextProfile.email}`,
        JSON.stringify({
          name: nextProfile.name,
          club: nextProfile.club,
          description: nextProfile.description
        })
      );
    }

    setIsEditingProfile(false);
    setProfileMessage("Profile updated.");
  }

  if (!authToken) {
    if (authView === "register") {
      return (
        <RegisterPage
          form={registerForm}
          message={registerMessage}
          isLoading={isRegisterLoading}
          isComplete={isRegisterComplete}
          onChange={setRegisterForm}
          onSubmit={handleRegister}
          onComplete={showLoginPage}
          onBackToLogin={showLoginPage}
        />
      );
    }

    return (
      <LoginPage
        form={loginForm}
        message={authMessage}
        isLoading={isAuthLoading}
        onChange={setLoginForm}
        onSubmit={handleLogin}
        onCreateAccount={showRegisterPage}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-panel">
          <span className="login-brand">scape</span>
          <p>{isAuthLoading ? "Signing you in..." : "Preparing your map..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo">TT</span>
          <div>
            <strong>TicketTailor</strong>
            <small>Event dashboard</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          <SidebarButton active={activePage === "profile"} onClick={() => setActivePage("profile")} icon="👤">
            Profile
          </SidebarButton>
          <SidebarButton active={activePage === "map"} onClick={() => setActivePage("map")} icon="🗺️">
            Map
          </SidebarButton>
          <SidebarButton active={activePage === "joined"} onClick={() => setActivePage("joined")} icon="🎟️">
            Joined events
          </SidebarButton>
          <SidebarButton active={activePage === "created"} onClick={() => setActivePage("created")} icon="🛠️">
            Created events
          </SidebarButton>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>{getPageTitle(activePage)}</h1>
            <p>{getPageSubtitle(activePage)}</p>
          </div>

          <AccountPanel user={currentUser} onLogout={handleLogout} />
        </header>

        {activePage === "profile" ? (
          <ProfilePage
            user={currentUser}
            joinedEvents={joinedEvents}
            createdEvents={createdEvents}
            calendarWeekStart={calendarWeekStart}
            onPreviousWeek={goToPreviousWeek}
            onNextWeek={goToNextWeek}
            onCurrentWeek={goToCurrentWeek}
            onOpenJoined={() => setActivePage("joined")}
            onOpenCreated={() => setActivePage("created")}
            profileDraft={profileDraft}
            isEditingProfile={isEditingProfile}
            profileMessage={profileMessage}
            onEditProfile={() => {
              setProfileDraft({
                name: currentUser?.name || "",
                club: currentUser?.club || "",
                description: currentUser?.description || ""
              });
              setProfileMessage("");
              setIsEditingProfile(true);
            }}
            onCancelProfile={() => {
              setProfileDraft({
                name: currentUser?.name || "",
                club: currentUser?.club || "",
                description: currentUser?.description || ""
              });
              setProfileMessage("");
              setIsEditingProfile(false);
            }}
            onSaveProfile={handleSaveProfile}
            onChangeProfile={handleProfileDraftChange}
          />
        ) : null}

        {activePage === "map" ? (
          <main className="map-page">
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

              <button
                type="button"
                className="create-button"
                onClick={() => {
                  setEditingEvent(null);
                  setEventForm(createInitialEventForm());
                  setIsCreateModalOpen(true);
                }}
              >
                Create event
              </button>
            </section>

            {isCreateModalOpen ? (
              <EventCreationForm
                form={eventForm}
                isSignedIn={Boolean(currentUser)}
                isCreating={isCreating}
                message={formMessage}
                categories={eventCategories}
                locations={UQ_LOCATIONS}
                onChange={updateEventForm}
                onSubmit={handleCreateEvent}
                onClose={() => setIsCreateModalOpen(false)}
                title="Initialise an event"
                submitLabel="Create event"
              />
            ) : null}

            <section className="status-bar">
              <span>{status}</span>
            </section>

            <section className="map-layout">
              <div ref={mapElementRef} className="map" aria-label="Event map" />

              <aside className="event-panel">
                <h2>Events</h2>
                <EventList
                  events={filteredEvents}
                  currentUser={currentUser}
                  createdEventIds={createdEventIds}
                  onFocusEvent={focusEvent}
                  onJoinEvent={handleJoinEvent}
                />
              </aside>
            </section>
          </main>
        ) : null}

        {activePage === "joined" ? (
          <EventsTable
            title="My joined events"
            events={joinedEvents}
            emptyMessage="No joined events found from the current event data."
            columns="joined"
            onShowOnMap={(event) => {
              setActivePage("map");
              setTimeout(() => focusEvent(event), 0);
            }}
          />
        ) : null}

        {activePage === "created" ? (
          <EventsTable
            title="My created events"
            events={createdEvents}
            emptyMessage="No created events found yet. Create an event from the map page first."
            columns="created"
            onShowOnMap={(event) => {
              setActivePage("map");
              setTimeout(() => focusEvent(event), 0);
            }}
            onEdit={openEditEvent}
            onCreate={() => {
              setActivePage("map");
              setTimeout(() => setIsCreateModalOpen(true), 0);
            }}
          />
        ) : null}

        {editingEvent ? (
          <EventCreationForm
            form={eventForm}
            isSignedIn={Boolean(currentUser)}
            isCreating={isCreating}
            message={formMessage}
            categories={eventCategories}
            locations={UQ_LOCATIONS}
            onChange={updateEventForm}
            onSubmit={handleUpdateEvent}
            onClose={closeEditEvent}
            title="Edit event"
            submitLabel="Save changes"
          />
        ) : null}
      </section>
    </div>
  );
}


function SidebarButton({ active, onClick, icon, children }) {
  return (
    <button type="button" className={`sidebar-button${active ? " active" : ""}`} onClick={onClick}>
      <span>{icon}</span>
      <strong>{children}</strong>
    </button>
  );
}

function ProfilePage({
  user,
  joinedEvents,
  createdEvents,
  calendarWeekStart,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onOpenJoined,
  onOpenCreated,
  profileDraft,
  isEditingProfile,
  profileMessage,
  onEditProfile,
  onCancelProfile,
  onSaveProfile,
  onChangeProfile
}) {
  const displayName = user.name || user.email || "Logged-in user";
  const displayClub = user.club || "TicketTailor user";
  const displayDescription =
    user.description || "No description yet. Click Edit profile to add one.";

  return (
    <main className="profile-page">
      <section className="profile-card profile-card-large">
        <div className="profile-avatar">{getInitials(user)}</div>

        <div className="profile-main-info">
          <div className="profile-title-row">
            <span className="eyebrow dark">Personal information</span>

            {!isEditingProfile ? (
              <button type="button" className="profile-edit-button" onClick={onEditProfile}>
                Edit profile
              </button>
            ) : null}
          </div>

          {isEditingProfile ? (
            <div className="profile-edit-area">
              <label>
                Name
                <input
                  value={profileDraft.name}
                  onChange={(event) => onChangeProfile("name", event.target.value)}
                  placeholder="Enter your name"
                  maxLength="50"
                />
              </label>

              <label>
                Club
                <input
                  value={profileDraft.club}
                  onChange={(event) => onChangeProfile("club", event.target.value)}
                  placeholder="Enter your club"
                  maxLength="80"
                />
              </label>

              <label className="profile-description-input">
                Description
                <textarea
                  value={profileDraft.description}
                  onChange={(event) => onChangeProfile("description", event.target.value)}
                  placeholder="Write a short introduction about yourself..."
                  maxLength="300"
                  rows="3"
                />
                <span>{profileDraft.description.length}/300</span>
              </label>

              <div className="profile-edit-actions">
                <button type="button" onClick={onSaveProfile}>
                  Save profile
                </button>
                <button type="button" className="secondary-button" onClick={onCancelProfile}>
                  Cancel
                </button>
              </div>

              {profileMessage ? <p className="profile-message">{profileMessage}</p> : null}
            </div>
          ) : (
            <>
              <h2>{displayName}</h2>
              <p>{displayClub}</p>

              <div className="profile-description-inline">
                <strong>Description</strong>
                <span>{displayDescription}</span>
              </div>

              {profileMessage ? <p className="profile-message">{profileMessage}</p> : null}
            </>
          )}
        </div>
      </section>

      <section className="profile-grid">
        <InfoCard label="Email" value={user.email || "N/A"} />
        <InfoCard label="Name" value={user.name || "N/A"} />
        <InfoCard label="Club" value={user.club || "N/A"} />
        <InfoCard label="Role" value={user.role || user.account_type || "User"} />
      </section>

      <section className="stats-row two-stats">
        <StatCard label="Joined events" value={joinedEvents.length} onClick={onOpenJoined} />
        <StatCard label="Created events" value={createdEvents.length} onClick={onOpenCreated} />
      </section>

      <EventCalendar
        joinedEvents={joinedEvents}
        createdEvents={createdEvents}
        weekStart={calendarWeekStart}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
        onCurrentWeek={onCurrentWeek}
      />
    </main>
  );
}

function InfoCard({ label, value }) {
  return (
    <article className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatCard({ label, value, onClick }) {
  return (
    <article className="stat-card compact-stat">
      <h3>{label}</h3>
      <p>{value}</p>
      {onClick ? <button type="button" onClick={onClick}>Open</button> : null}
    </article>
  );
}

function EventsTable({ title, events, emptyMessage, columns, onShowOnMap, onEdit, onCreate }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));
  const pageStart = (currentPage - 1) * EVENTS_PER_PAGE;
  const pageEvents = events.slice(pageStart, pageStart + EVENTS_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
    <main className="table-page">
      <div className="table-toolbar">
        <div>
          <h2>{title}</h2>
          <p>{events.length} event(s)</p>
        </div>
        {onCreate ? <button type="button" className="create-button" onClick={onCreate}>Create event</button> : null}
      </div>

      {events.length === 0 ? (
        <p className="empty-message table-empty">{emptyMessage}</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Event</th>
                {columns === "created" ? <th>Created time</th> : null}
                <th>Location</th>
                <th>Attendees</th>
                <th>Start time</th>
                <th>End time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageEvents.map((event) => (
                <tr key={event.id || `${event.title}-${event.start_time}`}>
                  <td>
                    <strong>{event.title || "Untitled Event"}</strong>
                    <span>{event.category || "N/A"}</span>
                  </td>
                  {columns === "created" ? <td>{formatDateTime(event.created_at || event.created_time)}</td> : null}
                  <td>{event.location_name || "N/A"}</td>
                  <td>{event.attendee_count ?? getAttendeeCount(event)}</td>
                  <td>{formatDateTime(event.start_time)}</td>
                  <td>{formatDateTime(event.end_time)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onShowOnMap(event)}>Map</button>
                      {onEdit ? <button type="button" className="secondary-button" onClick={() => onEdit(event)}>Edit</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events.length > 0 ? (
        <div className="table-pagination" aria-label={`${title} pagination`}>
          <span>
            Showing {pageStart + 1}-{Math.min(pageStart + pageEvents.length, events.length)} of {events.length}
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <strong>Page {currentPage} of {totalPages}</strong>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function EventCalendar({
  joinedEvents,
  createdEvents,
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek
}) {
  const activeWeekStart = weekStart || getStartOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(activeWeekStart, index));
  const firstHour = 0;
  const lastHour = 24;
  const totalMinutes = (lastHour - firstHour) * 60;
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const calendarItems = [
    ...joinedEvents.map((event) => ({ event, type: "joined" })),
    ...createdEvents.map((event) => ({ event, type: "created" }))
  ].filter(({ event }) => isEventInWeek(event, activeWeekStart));

  return (
    <section className="calendar-card" aria-label="Weekly event calendar">
      <div className="calendar-title-row">
        <div>
          <h2>Weekly event calendar</h2>
          <p>Red blocks are joined events. Green blocks are events you created.</p>
        </div>
        <div className="calendar-week-controls">
          <button type="button" onClick={onPreviousWeek}>‹ Previous</button>
          <strong>{formatWeekRange(days)}</strong>
          <button type="button" onClick={onNextWeek}>Next ›</button>
          <button type="button" className="calendar-today-button" onClick={onCurrentWeek}>This week</button>
        </div>
      </div>

      <div className="calendar-legend">
        <span><i className="joined-dot" /> Joined event</span>
        <span><i className="created-dot" /> Created event</span>
      </div>

      <div className="calendar-grid">
        <div className="calendar-corner" />
        <div className="calendar-day-header-row">
          {days.map((day) => (
            <div className="calendar-day-heading" key={day.toISOString()}>
              {formatDayHeading(day)}
            </div>
          ))}
        </div>

        <div className="calendar-time-column">
          {hours.map((hour) => (
            <div className="calendar-time" key={hour}>{formatHour(hour)}</div>
          ))}
        </div>

        <div className="calendar-days-area">
          {days.map((day) => (
            <div className="calendar-day-column" key={day.toISOString()}>
              {hours.map((hour) => <div className="calendar-hour-line" key={hour} />)}
            </div>
          ))}

          {calendarItems.map(({ event, type }) => {
            const start = getEventDate(event.start_time);
            const end = getEventDate(event.end_time) || new Date(start.getTime() + 60 * 60 * 1000);
            const dayIndex = Math.max(0, Math.min(6, Math.floor((stripTime(start) - stripTime(activeWeekStart)) / 86400000)));
            const startMinutes = Math.max(firstHour * 60, start.getHours() * 60 + start.getMinutes());
            const endMinutes = Math.min(lastHour * 60, end.getHours() * 60 + end.getMinutes());
            const top = ((startMinutes - firstHour * 60) / totalMinutes) * 100;
            const height = Math.max(7, ((Math.max(endMinutes, startMinutes + 30) - startMinutes) / totalMinutes) * 100);

            return (
              <article
                className={`calendar-event ${type === "joined" ? "joined-event" : "created-event"}`}
                key={`${type}-${event.id || event.title}-${event.start_time}`}
                style={{
                  left: `calc(${(dayIndex / 7) * 100}% + 4px)`,
                  width: `calc(${100 / 7}% - 8px)`,
                  top: `${top}%`,
                  height: `${height}%`
                }}
                title={`${event.title || "Untitled Event"} - ${formatDateTime(event.start_time)}`}
              >
                <strong>{event.title || "Untitled Event"}</strong>
                <span>{event.location_name || "N/A"}</span>
                <small>{formatTimeOnly(start)} - {formatTimeOnly(end)}</small>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getPageTitle(page) {
  if (page === "map") return "Event map";
  if (page === "joined") return "My joined events";
  if (page === "created") return "My created events";
  return "Personal information";
}

function getPageSubtitle(page) {
  if (page === "map") return "Discover campus events around UQ.";
  if (page === "joined") return "Events you have joined, with location, attendees, start time, and end time.";
  if (page === "created") return "Events you created. Edit here and the map updates from the same data.";
  return "Your account summary and quick access to the event dashboard.";
}

function AccountPanel({
  user,
  onLogout
}) {
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

function EventCreationForm({
  form,
  isSignedIn,
  isCreating,
  message,
  categories,
  locations,
  onChange,
  onSubmit,
  onClose,
  title = "Initialise an event",
  submitLabel = "Create event"
}) {
  const isTicketed = form.pricing_type === "ticketed";

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <section className="creation-card creation-modal" aria-label="Create event">
        <button type="button" className="close-button" onClick={onClose}>
          ×
        </button>
      <div className="creation-intro">
        <span className="eyebrow">Committee tools</span>
        <h2>{title}</h2>
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
          <select
            value={form.location_name}
            onChange={(event) => onChange("location_name", event.target.value)}
            required
          >
            {locations.map((location) => (
              <option key={location.name} value={location.name}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Start time
          <input
            type="datetime-local"
            lang="en-AU"
            value={form.start_time}
            onChange={(event) => onChange("start_time", event.target.value)}
            required
          />
        </label>

        <label>
          End time
          <input
            type="datetime-local"
            lang="en-AU"
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
            {isCreating ? "Saving..." : submitLabel}
          </button>
          <span>{isSignedIn ? "Any logged-in user can create." : "Sign in to create events."}</span>
        </div>

        {message ? <p className="form-message wide-field">{message}</p> : null}
      </form>
    </section>
  </div>
);
}

function EventList({ events, currentUser, createdEventIds, onFocusEvent, onJoinEvent }) {
  if (events.length === 0) {
    return <p className="empty-message">No events found.</p>;
  }

  return (
    <div className="event-list">
      {events.map((event) => {
        const isCreatedByCurrentUser = isUserCreatedEvent(event, currentUser, createdEventIds);
        const isJoinedByCurrentUser = isUserJoinedEvent(event, currentUser);
        const joinDisabled = isCreatedByCurrentUser || isJoinedByCurrentUser;

        return (
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

          <button
            type="button"
            className="create-button"
            onClick={() => onJoinEvent(event)}
            disabled={joinDisabled}
          >
            {isCreatedByCurrentUser ? "Your event" : isJoinedByCurrentUser ? "Joined" : "Join"}
          </button>
        </article>
        );
      })}
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


function getInitials(user) {
  const source = user?.name || user?.email || "TT";
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("") || "TT";
}

function getCurrentUserKey(user) {
  return String(user?.id || user?.user_id || user?.email || "anonymous");
}

function getCreatedEventStorageKey(user) {
  return `createdEventIds:${getCurrentUserKey(user)}`;
}

function loadCreatedEventIdsForUser(user) {
  if (!user) return [];

  try {
    const value = localStorage.getItem(getCreatedEventStorageKey(user));
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function isUserCreatedEvent(event, user, createdEventIds = []) {
  if (!event || !user) return false;
  const userIds = [user.id, user.user_id, user.email].filter(Boolean).map(String);
  const eventOwners = [event.creator_id, event.created_by, event.user_id, event.owner_id, event.creator_email, event.owner_email]
    .filter(Boolean)
    .map(String);

  return createdEventIds.map(String).includes(String(event.id)) || eventOwners.some((owner) => userIds.includes(owner));
}

function isUserJoinedEvent(event, user) {
  if (!event || !user) return false;
  if (event.joined_by_current_user || event.is_joined || event.is_attending) return true;

  const userIds = [user.id, user.user_id, user.email].filter(Boolean).map(String);
  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const attendeeIds = Array.isArray(event.attendee_ids) ? event.attendee_ids : [];
  const attendeeEmails = Array.isArray(event.attendee_emails) ? event.attendee_emails : [];

  return [...attendeeIds, ...attendeeEmails, ...attendees.map((item) => item?.id || item?.user_id || item?.email)]
    .filter(Boolean)
    .map(String)
    .some((item) => userIds.includes(item));
}

function getEventTimeRange(event) {
  const start = getEventDate(event?.start_time);
  if (!start) return null;

  const end = getEventDate(event?.end_time) || new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function doEventsOverlap(firstEvent, secondEvent) {
  const first = getEventTimeRange(firstEvent);
  const second = getEventTimeRange(secondEvent);

  if (!first || !second) return false;
  return first.start < second.end && first.end > second.start;
}

function findTimeConflict(targetEvent, existingEvents) {
  return existingEvents.find((event) => {
    if (String(event.id) === String(targetEvent.id)) return false;
    return doEventsOverlap(targetEvent, event);
  });
}

function getAttendeeCount(event) {
  if (Array.isArray(event.attendees)) return event.attendees.length;
  if (Array.isArray(event.attendee_ids)) return event.attendee_ids.length;
  if (Array.isArray(event.attendee_emails)) return event.attendee_emails.length;
  return 0;
}

function toDateTimeLocalValueFromApi(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return toDateTimeLocalValue(date);
}

function getStartOfWeek(date) {
  const result = stripTime(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getEventDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEventInWeek(event, weekStart) {
  const start = getEventDate(event.start_time);
  if (!start) return false;
  const weekEnd = addDays(weekStart, 7);
  return start >= weekStart && start < weekEnd;
}

function formatWeekRange(days) {
  if (!days.length) return "";
  return `${formatShortDate(days[0])} - ${formatShortDate(days[6])}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDayHeading(date) {
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "numeric" });
}

function formatHour(hour) {
  if (hour === 0 || hour === 24) return "12:00 AM";
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${suffix}`;
}

function formatTimeOnly(date) {
  if (!date) return "N/A";
  return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default App;
