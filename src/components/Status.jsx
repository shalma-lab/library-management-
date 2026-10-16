import React from "react";

// Shared loading / error feedback for API-driven screens. Styled to match the
// existing empty-state box so every screen looks consistent.
export function LoadingState({ message = "Loading..." }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state error-state" role="alert">
      <p>{message || "Something went wrong."}</p>
      {onRetry && (
        <button className="btn-outline" style={{ marginTop: "14px" }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
