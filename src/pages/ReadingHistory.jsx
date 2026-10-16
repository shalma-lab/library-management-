import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../context/LibraryContext";
import { LoadingState, ErrorState } from "../components/Status";
import AuthNotice from "../components/AuthNotice";

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ReadingHistory reads history + book lookup straight from context.
function ReadingHistory() {
  const { booksStatus, booksError, reloadBooks, history, findBookById } = useLibrary();

  // useMemo: most recently returned book first. Only re-sorts when
  // history actually changes.
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.returnedOn) - new Date(a.returnedOn)),
    [history]
  );

  return (
    <div className="container">
      <h1 className="page-title">Reading History</h1>
      <p className="page-subtitle">Every book you've borrowed and returned so far.</p>
      <AuthNotice />

      {/* Book titles come from the API, so wait for them (or show the error). */}
      {booksStatus === "loading" ? (
        <LoadingState message="Loading your history..." />
      ) : booksStatus === "error" ? (
        <ErrorState message={booksError} onRetry={reloadBooks} />
      ) : sortedHistory.length === 0 ? (
        <div className="empty-state">
          <p>No reading history available</p>
        </div>
      ) : (
        <div className="loan-list">
          {sortedHistory.map((entry, index) => {
            const book = findBookById(entry.bookId);
            if (!book) return null;

            return (
              <div className="loan-row" key={`${entry.bookId}-${index}`}>
                <div className="info">
                  <h3>
                    <Link to={`/books/${book.id}`}>{book.title}</Link>
                  </h3>
                  <p style={{ margin: "2px 0", color: "#666" }}>{book.author}</p>
                  <div className="dates">
                    <span>Borrowed: {formatDate(entry.borrowedOn)}</span>
                    <span>Returned: {formatDate(entry.returnedOn)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReadingHistory;
