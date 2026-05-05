import { useState } from "react";
import { apiRequest, goTo } from "../api.js";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const data = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });

      localStorage.setItem("token", data.token);
      goTo("/map");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="TicketTailor overview">
        <div className="brand-row">
          <span className="brand-mark">T</span>
          <span>TicketTailor</span>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Campus events, organised</p>
          <h1>Find the societies, meetups, and events happening around you.</h1>
          <p>
            Explore nearby university events, follow club activity, and keep
            your plans in one place.
          </p>
        </div>

        <div className="preview-stack">
          <div className="mini-card">
            <strong>Board Games Night</strong>
            <span>UQ Union Complex · 24 attending</span>
          </div>
          <div className="mini-card offset">
            <strong>Live Music on the Lawn</strong>
            <span>Great Court · Public event</span>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Login form">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in</h2>
          </div>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder="Enter your password"
              required
            />
          </label>

          {message && <p className="form-message error">{message}</p>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="auth-switch">
            New to TicketTailor?{" "}
            <button type="button" onClick={() => goTo("/register")}>
              Create account
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
