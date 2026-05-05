import { useState } from "react";
import { apiRequest, goTo } from "../api.js";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    description: "",
    club: ""
  });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(form)
      });

      goTo("/login");
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
    <main className="auth-shell compact">
      <section className="auth-panel centered" aria-label="Registration form">
        <form className="auth-card wide" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Join TicketTailor</p>
            <h2>Create account</h2>
          </div>

          <div className="field-grid">
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Choose a password"
                required
              />
            </label>

            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label>
              Club
              <input
                value={form.club}
                onChange={(event) => updateField("club", event.target.value)}
                placeholder="Club or society"
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="A short profile description"
              rows="4"
            />
          </label>

          {message && <p className="form-message error">{message}</p>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
          </button>

          <p className="auth-switch">
            Already registered?{" "}
            <button type="button" onClick={() => goTo("/login")}>
              Sign in
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
