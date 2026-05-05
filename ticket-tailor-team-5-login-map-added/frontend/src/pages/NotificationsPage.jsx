import { useEffect, useState } from "react";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("Loading notifications...");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const data = await apiRequest("/api/v1/notifications");
      setNotifications(data);
      setMessage(data.length ? "" : "No notifications yet.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function markRead(notification) {
    try {
      const updated = await apiRequest(`/api/v1/notifications/${notification.id}/read`, {
        method: "PUT"
      });
      setNotifications((items) =>
        items.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="app-shell">
      <TopNav />
      <section className="content-band">
        <div className="detail-panel">
          <div>
            <p className="eyebrow">Updates</p>
            <h1>Notifications</h1>
          </div>

          {message && <p className="form-message">{message}</p>}

          <div className="notification-list">
            {notifications.map((notification) => (
              <article
                className={`notification-card ${notification.read_at ? "" : "unread"}`}
                key={notification.id}
              >
                <p>{notification.message}</p>
                <span>{formatDateTime(notification.created_at)}</span>
                <div className="button-row compact-row">
                  {notification.event_id && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => goTo(`/events/${notification.event_id}`)}
                    >
                      View event
                    </button>
                  )}
                  {!notification.read_at && (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => markRead(notification)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "";
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
