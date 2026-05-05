import { useEffect, useState } from "react";
import { apiRequest, goTo } from "../api.js";
import TopNav from "../components/TopNav.jsx";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      goTo("/login");
      return;
    }

    apiRequest("/api/v1/profile")
      .then((data) => {
        setProfile(data);
        setMessage("");
      })
      .catch((error) => {
        localStorage.removeItem("token");
        setMessage(error.message);
        goTo("/login");
      });
  }, []);

  function logout() {
    localStorage.removeItem("token");
    goTo("/login");
  }

  return (
    <main className="app-shell">
      <TopNav />
      <section className="content-band">
        <div className="profile-panel">
          <div>
            <p className="eyebrow">Profile</p>
            <h1>{profile?.name || "Your profile"}</h1>
          </div>

          {message && <p className="form-message">{message}</p>}

          {profile && (
            <dl className="profile-grid">
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>Club</dt>
                <dd>{profile.club || "Not set"}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{profile.description || "Not set"}</dd>
              </div>
            </dl>
          )}

          <button className="secondary-button" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}
