import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateIdentifier, validatePassword, validateLoginForm } from "../utils/validators";

// Login page: a controlled form (React state owns every input value).
function Login() {
  const { member, isAuthenticated, isInitializing, notice, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // If a protected page sent the member here, go back to it afterwards.
  const redirectTo = location.state?.from?.pathname || "/";

  const [values, setValues] = useState({ identifier: "", password: "" });
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A ref blocks a second submit in the same tick, before state has updated.
  const submittingRef = useRef(false);

  const fieldValidators = { identifier: validateIdentifier, password: validatePassword };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setSubmitError("");
    // Re-check a field as it's edited, but only once it's been visited.
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: fieldValidators[name](value) }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: fieldValidators[name](value) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const formErrors = validateLoginForm(values);
    setErrors(formErrors);
    setTouched({ identifier: true, password: true });
    if (Object.keys(formErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await login(values.identifier.trim(), values.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setSubmitError(err.message || "Something went wrong while signing in. Please try again.");
      setValues((prev) => ({ ...prev, password: "" }));
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Wait for the session check so the form doesn't flash for a signed-in member.
  if (isInitializing) {
    return (
      <div className="container">
        <p className="auth-status" role="status">Checking your session…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="container">
        <div className="auth-card">
          <h1 className="page-title">You're signed in</h1>
          <p className="page-subtitle">
            Signed in as {member.name} (Member #{member.id}).
          </p>
          <div className="auth-actions">
            <button className="btn-primary" onClick={() => navigate("/")}>
              Go to home
            </button>
            <button className="btn-secondary" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="auth-card">
        <h1 className="page-title">Member Login</h1>
        <p className="page-subtitle">Sign in with your Member ID or email.</p>

        {submitError && (
          <div className="form-alert" role="alert">
            {submitError}
          </div>
        )}

        {!submitError && notice && (
          <div className="form-alert" role="alert">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="identifier">Member ID or email</label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="M-1001 or name@example.com"
              value={values.identifier}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
              className={errors.identifier ? "has-error" : ""}
            />
            {errors.identifier && (
              <p className="field-error" id="identifier-error">
                {errors.identifier}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={errors.password ? "has-error" : ""}
            />
            {errors.password && (
              <p className="field-error" id="password-error">
                {errors.password}
              </p>
            )}
          </div>

          <button className="btn-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
