import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import MapPage from "./pages/MapPage.jsx";
import EventDetailPage from "./pages/EventDetailPage.jsx";
import EventFormPage from "./pages/EventFormPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";

const routes = {
  "/": LoginPage,
  "/login": LoginPage,
  "/login.html": LoginPage,
  "/register": RegisterPage,
  "/register.html": RegisterPage,
  "/profile": ProfilePage,
  "/profile.html": ProfilePage,
  "/map": MapPage,
  "/map.html": MapPage,
  "/events/new": EventFormPage,
  "/notifications": NotificationsPage
};

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleNavigation = () => setPath(window.location.pathname);

    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  const StaticPage = routes[path];
  if (StaticPage) {
    return <StaticPage />;
  }

  if (path.startsWith("/events/") && path.endsWith("/edit")) {
    const eventId = path.split("/")[2];
    return <EventFormPage eventId={eventId} />;
  }

  if (path.startsWith("/events/")) {
    const eventId = path.split("/")[2];
    return <EventDetailPage eventId={eventId} />;
  }

  return <MapPage />;
}
