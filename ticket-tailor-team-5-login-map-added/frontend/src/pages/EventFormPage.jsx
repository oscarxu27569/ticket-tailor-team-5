import { useEffect, useState } from "react";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

const categories = ["Gaming", "Music", "Food", "Sports", "Academic", "Career", "Culture"];

const emptyEvent = {
  title: "",
  description: "",
  location_name: "",
  latitude: "-27.4975",
  longitude: "153.0137",
  category: "Culture",
  visibility: "public",
  price: "0",
  capacity: "",
  start_time: "",
  end_time: "",
  club: "",
  public_at: ""
};

export default function EventFormPage({ eventId }) {
  const isEditing = Boolean(eventId);
  const [form, setForm] = useState(emptyEvent);
  const [message, setMessage] = useState(isEditing ? "Loading event..." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    apiRequest(`/api/v1/events/${eventId}`)
      .then((event) => {
        setForm({
          title: event.title || "",
          description: event.description || "",
          location_name: event.location_name || "",
          latitude: String(event.latitude ?? ""),
          longitude: String(event.longitude ?? ""),
          category: event.category || "Culture",
          visibility: event.visibility || "public",
          price: String(event.price ?? 0),
          capacity: event.capacity ? String(event.capacity) : "",
          start_time: toDatetimeLocal(event.start_time),
          end_time: toDatetimeLocal(event.end_time),
          club: event.club || "",
          public_at: toDatetimeLocal(event.public_at)
        });
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }, [eventId, isEditing]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      price: form.price === "" ? 0 : Number(form.price),
      capacity: form.capacity === "" ? null : Number(form.capacity),
      start_time: toIsoString(form.start_time),
      end_time: form.end_time ? toIsoString(form.end_time) : null,
      public_at: form.public_at ? toIsoString(form.public_at) : null
    };

    try {
      const saved = await apiRequest(
        isEditing ? `/api/v1/events/${eventId}` : "/api/v1/events",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      goTo(`/events/${saved.id}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  return (
    <main className="app-shell">
      <TopNav />
      <section className="content-band">
        <form className="editor-panel" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">{isEditing ? "Organiser tools" : "New event"}</p>
            <h1>{isEditing ? "Edit event" : "Create event"}</h1>
          </div>

          {message && <p className="form-message error">{message}</p>}

          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows="4"
            />
          </label>

          <div className="field-grid">
            <label>
              Location
              <input
                value={form.location_name}
                onChange={(event) => updateField("location_name", event.target.value)}
                required
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={(event) => updateField("latitude", event.target.value)}
                required
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={(event) => updateField("longitude", event.target.value)}
                required
              />
            </label>
            <label>
              Start time
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(event) => updateField("start_time", event.target.value)}
                required
              />
            </label>
            <label>
              End time
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(event) => updateField("end_time", event.target.value)}
              />
            </label>
            <label>
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
              />
            </label>
            <label>
              Capacity
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(event) => updateField("capacity", event.target.value)}
              />
            </label>
            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={(event) => updateField("visibility", event.target.value)}
              >
                <option value="public">Public</option>
                <option value="club_only">Club only</option>
              </select>
            </label>
            <label>
              Club
              <input
                value={form.club}
                onChange={(event) => updateField("club", event.target.value)}
              />
            </label>
            <label>
              Public from
              <input
                type="datetime-local"
                value={form.public_at}
                onChange={(event) => updateField("public_at", event.target.value)}
              />
            </label>
          </div>

          <div className="button-row">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save event"}
            </button>
            <button className="secondary-button" type="button" onClick={() => goTo("/map")}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function toIsoString(value) {
  return new Date(value).toISOString();
}
