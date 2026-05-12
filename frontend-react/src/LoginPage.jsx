function LoginPage({ form, message, isLoading, onChange, onSubmit, onCreateAccount }) {
  return (
    <main className="login-screen">
      <section className="login-card" aria-label="Log in">
        <span className="login-brand">Ticket-talor</span>
        <h1>WELCOME BACK</h1>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              placeholder="Email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => onChange({ ...form, password: event.target.value })}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "LOGGING IN..." : "LOG IN"}
          </button>
        </form>

        <button className="create-account-link" type="button" onClick={onCreateAccount}>
          Create account
        </button>

        {message ? <p className="login-message">{message}</p> : null}

        <p className="login-note">
          Please note you have a maximum of 10 attempts before your account will be locked.
          If you're uncertain of your password, <span>please reset your password.</span>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
