import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Experiment 4d — non-blocking hint shown on Borrowed / History / Profile.
// Those screens keep working for guests exactly as they always did (nothing
// was removed); a signed-in member additionally gets the token-protected API
// sync. The notice disappears the moment the member signs in, so the original
// experience is untouched for logged-in users.
export default function AuthNotice() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing || isAuthenticated) return null;

  return (
    <div className="auth-notice" role="note">
      <span>
        Browsing as a guest. Borrowing, renewals, history and profile only sync through the
        authenticated API once you&apos;re signed in.
      </span>
      <Link to="/login" className="auth-notice-link">
        Sign in
      </Link>
    </div>
  );
}
