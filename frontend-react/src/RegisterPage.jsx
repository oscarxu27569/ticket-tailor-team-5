function RegisterPage({
  form,
  message,
  isLoading,
  isComplete,
  onChange,
  onSubmit,
  onComplete,
  onBackToLogin
}) {
  return (
    <main className="login-screen">
      <section className="login-card" aria-label="Create account">
        <span className="login-brand">Ticket-talor</span>
        <h1>CREATE ACCOUNT</h1>

        {isComplete ? (
          <div className="register-success">
            <p>{message || "Your account has been created."}</p>
            <button type="button" onClick={onComplete}>
              DONE
            </button>
          </div>
        ) : (
          <>
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
                  autoComplete="new-password"
                  required
                />
              </label>

              <button type="submit" disabled={isLoading}>
                {isLoading ? "CREATING..." : "CREATE ACCOUNT"}
              </button>
            </form>

            <button className="create-account-link" type="button" onClick={onBackToLogin}>
              Back to login
            </button>

            {message ? <p className="login-message">{message}</p> : null}
          </>
        )}
      </section>
    </main>
  );
}

export default RegisterPage;
