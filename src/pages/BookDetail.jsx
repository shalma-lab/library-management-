import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLibrary } from "../context/LibraryContext";
import { useBook, useRelatedBooks } from "../hooks/useBook";
import { LoadingState, ErrorState } from "../components/Status";
import RecommendationsList from "../components/Recommendations";

// BookDetail reads the book id from the URL and fetches that book from the
// REST API (GET /api/books/:id). Borrowing status and the borrow/hold
// actions still come from LibraryContext -- no props needed.
function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findBookById, isBorrowed, isOnHold, borrowBook, placeHold, lastMessage } = useLibrary();

  const detail = useBook(id);
  const related = useRelatedBooks(id);

  if (detail.status === "loading") {
    return (
      <div className="container">
        <LoadingState message="Loading book details..." />
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <div className="container">
        <ErrorState message={detail.error} onRetry={detail.retry} />
        <p style={{ marginTop: "15px" }}>
          <Link to="/books">← Back to Books</Link>
        </p>
      </div>
    );
  }

  if (detail.status === "notfound") {
    return (
      <div className="container">
        <p>Sorry, that book could not be found.</p>
        <Link to="/books">← Back to Books</Link>
      </div>
    );
  }

  // Borrowing happens in the browser (see useBorrowing), so the live copy
  // count from the catalog in context wins over the count fetched with the details.
  const live = findBookById(detail.book.id);
  const book = live ? { ...detail.book, availableCopies: live.availableCopies } : detail.book;
  const coverSrc = book.coverImage || book.coverUrl;

  const alreadyBorrowed = isBorrowed(book.id);
  const alreadyOnHold = isOnHold(book.id);
  const isAvailable = book.availableCopies > 0;

  return (
    <div className="container">
      <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: "15px" }}>
        ← Back
      </button>

      <div className="details-card">
        {coverSrc && <img className="details-cover" src={coverSrc} alt={`Cover of ${book.title}`} />}
        {book.category && <span className="category">{book.category}</span>}
        <h1>{book.title}</h1>
        {book.author && <p className="author">by {book.author}</p>}

        {/* Optional fields are only shown when the book actually has them. */}
        <div className="details-facts">
          {book.year && (
            <div>
              <div className="fact-label">Published</div>
              <div className="fact-value">{book.year}</div>
            </div>
          )}
          {book.publisher && (
            <div>
              <div className="fact-label">Publisher</div>
              <div className="fact-value">{book.publisher}</div>
            </div>
          )}
          {book.isbn && (
            <div>
              <div className="fact-label">ISBN</div>
              <div className="fact-value">{book.isbn}</div>
            </div>
          )}
          {book.rating !== undefined && (
            <div>
              <div className="fact-label">Rating</div>
              <div className="fact-value">⭐ {book.rating}</div>
            </div>
          )}
          <div>
            <div className="fact-label">Copies</div>
            <div className="fact-value">
              {book.availableCopies} / {book.totalCopies} available
            </div>
          </div>
        </div>

        {book.description && <p>{book.description}</p>}

        {/* Conditional rendering based on borrowing status */}
        <div className="details-actions">
          {alreadyBorrowed ? (
            <span className="status-msg success">You already have this book borrowed</span>
          ) : isAvailable ? (
            <button className="btn-primary" onClick={() => borrowBook(book.id)}>
              Borrow this book
            </button>
          ) : alreadyOnHold ? (
            <span className="status-msg warning">Hold placed — you're in the queue</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span className="status-msg warning">Book currently unavailable</span>
              <button className="btn-outline" onClick={() => placeHold(book.id)}>
                Place a hold
              </button>
            </div>
          )}
        </div>

        {lastMessage && <p style={{ marginTop: "12px", color: "#666", fontSize: "0.85rem" }}>{lastMessage}</p>}
      </div>

      {/* Related books (GET /api/books/:id/related). A failure here never hides the book itself. */}
      <div style={{ marginTop: "36px" }}>
        {related.status === "loading" ? (
          <LoadingState message="Loading related books..." />
        ) : related.status === "error" ? (
          <ErrorState message={related.error} onRetry={related.retry} />
        ) : (
          related.books.length > 0 && (
            <RecommendationsList
              title="Related books"
              books={related.books}
              getReason={(b) => (b.author === book.author ? `Also by ${b.author}` : `More ${b.category}`)}
            />
          )
        )}
      </div>
    </div>
  );
}

export default BookDetail;
