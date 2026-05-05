import { goTo } from "../api.js";

export default function TopNav() {
  return (
    <nav className="top-nav">
      <button type="button" className="nav-brand" onClick={() => goTo("/map")}>
        <span className="brand-mark small">T</span>
        TicketTailor
      </button>
      <div className="nav-actions">
        <button type="button" onClick={() => goTo("/map")}>
          Map
        </button>
        <button type="button" onClick={() => goTo("/events/new")}>
          Create event
        </button>
        <button type="button" onClick={() => goTo("/notifications")}>
          Notifications
        </button>
        <button type="button" onClick={() => goTo("/profile")}>
          Profile
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("token");
            goTo("/login");
          }}
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
