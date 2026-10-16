import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./Status";

// Experiment 4d — the Manage screen works with token-protected endpoints, so
// it requires a signed-in member. Wait for the session check first (otherwise
// a refresh would bounce a signed-in member to /login for a frame), then
// either render the screen or hand over to Login with the original location.
//
// Every pre-existing page stays guest-accessible: only this new screen is
// gated, so nothing in the original app changed behaviour.
export default function RequireAuth({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="container">
        <LoadingState message="Checking your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
