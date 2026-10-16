import React from "react";
import { useLibrary } from "../context/LibraryContext";
import { LoadingState, ErrorState } from "../components/Status";
import AuthNotice from "../components/AuthNotice";

// Profile reads the member info and borrowing stats straight from context.
function Profile() {
  const { member, memberStatus, memberError, reloadMember, loans, holds, overdueLoans, readingStats, clearBorrowing } = useLibrary();

  const handleClearBorrowing = () => {
    const confirmed = window.confirm(
      "This will clear all borrowed books, holds, and reading history. Continue?"
    );
    if (confirmed) {
      clearBorrowing();
    }
  };

  // Member details come from the REST API: wait for them before rendering.
  if (!member) {
    return (
      <div className="container">
        <h1 className="page-title">My Profile</h1>
        {memberStatus === "error" ? (
          <ErrorState message={memberError} onRetry={reloadMember} />
        ) : (
          <LoadingState message="Loading your profile..." />
        )}
      </div>
    );
  }

  const initials = member.name
    .split(" ")
    .map((word) => word[0])
    .join("");

  const memberSince = new Date(member.memberSince).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="container">
      <h1 className="page-title">My Profile</h1>
      <p className="page-subtitle">Your membership details and borrowing stats.</p>
      <AuthNotice />

      <div className="profile-grid">
        <div className="profile-card">
          <div className="avatar">{initials}</div>
          <h2 style={{ margin: "0 0 3px" }}>{member.name}</h2>
          <p style={{ margin: 0, color: "#777", fontSize: "0.85rem" }}>Member #{member.id}</p>
          <span className="tier-badge">{member.membershipTier} member</span>
          <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#666" }}>
            Member since {memberSince}
          </p>

          <div style={{ textAlign: "left", marginTop: "15px" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: "bold", margin: "0 0 6px" }}>
              Favorite categories
            </p>
            {member.favoriteCategories.map((category) => (
              <span className="tag" key={category}>
                {category}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="num">{loans.length}</div>
              <div className="label">Currently borrowed</div>
            </div>
            <div className="stat-box">
              <div className="num">{readingStats.totalRead}</div>
              <div className="label">Books read total</div>
            </div>
            <div className="stat-box">
              <div className="num">{holds.length}</div>
              <div className="label">Active holds</div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-box">
              <div className="num">{readingStats.favoriteCategory}</div>
              <div className="label">Favorite category</div>
            </div>
            <div className="stat-box">
              <div className="num">{readingStats.avgDaysKept}</div>
              <div className="label">Avg. days per book</div>
            </div>
            <div className="stat-box">
              <div className="num">{overdueLoans.length}</div>
              <div className="label">Overdue right now</div>
            </div>
            <div className="stat-box">
              <div className="num">{readingStats.totalBorrowed}</div>
              <div className="label">Total borrowed all-time</div>
            </div>
          </div>

          {/* Conditional rendering: overdue warning */}
          {overdueLoans.length > 0 && (
            <div className="loan-row overdue">
              <div className="info">
                <h3 style={{ color: "#c0392b" }}>
                  {overdueLoans.length} book{overdueLoans.length > 1 ? "s" : ""} overdue
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                  Return or renew them from the Borrowed Books page.
                </p>
              </div>
            </div>
          )}

          <button
            className="btn-secondary"
            style={{ marginTop: "15px" }}
            onClick={handleClearBorrowing}
          >
            Clear borrowing history
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
