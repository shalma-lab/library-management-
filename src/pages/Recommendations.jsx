import React from "react";
import RecommendationsSection from "../components/RecommendationsSection";

// The Recommendations page shows recommendations fetched from the REST API
// (see LibraryContext + services/recommendationService.js) through the
// shared RecommendationsSection, which handles loading, error and empty states.
function RecommendationsPage() {
  return (
    <div className="container">
      <h1 className="page-title">Recommended for you</h1>
      <p className="page-subtitle">Based on your reading history and favorite categories.</p>

      <RecommendationsSection showEmpty />
    </div>
  );
}

export default RecommendationsPage;
