import React from "react";
import RecommendationsList from "./Recommendations";
import { LoadingState, ErrorState } from "./Status";
import { useLibrary } from "../context/LibraryContext";

// Shows API-based recommendations with loading / error / empty states.
// If the API request fails, the original in-browser suggestions are shown
// below the error, clearly labelled as NOT coming from the server.
function RecommendationsSection({ title, showEmpty = false }) {
  const {
    recommendedBooks,
    recommendationsStatus,
    recommendationsError,
    reloadRecommendations,
    localRecommendedBooks,
  } = useLibrary();

  if (recommendationsStatus === "loading") {
    return (
      <div>
        {title && <h2 className="page-title">{title}</h2>}
        <LoadingState message="Loading recommendations..." />
      </div>
    );
  }

  if (recommendationsStatus === "error") {
    return (
      <div>
        {title && <h2 className="page-title">{title}</h2>}
        <ErrorState message={recommendationsError} onRetry={reloadRecommendations} />
        {localRecommendedBooks.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <p className="rec-note">
              Suggestions below are calculated in your browser from the books already loaded. They
              are not personalised recommendations from the server.
            </p>
            <RecommendationsList books={localRecommendedBooks} />
          </div>
        )}
      </div>
    );
  }

  if (recommendedBooks.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="empty-state">
        <p>Borrow and return a few books to get personalized recommendations.</p>
      </div>
    );
  }

  return <RecommendationsList title={title} books={recommendedBooks} />;
}

export default RecommendationsSection;
