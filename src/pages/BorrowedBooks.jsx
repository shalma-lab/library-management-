import React from "react";
import { Link } from "react-router-dom";
import { MAX_RENEWALS } from "../data/sampleData";
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

// BorrowedBooks reads loans + the return/renew actions from context.
function BorrowedBooks() {
  const { booksStatus, booksError, reloadBooks, loans, findBookById, returnBook, renewBook, overdueLoans, dueSoonLoans } = useLibrary();

  return (
    <div className="container">
      <h1 className="page-title">Borrowed Books</h1>
      <p className="page-subtitle">Renew before the due date, or return a book when you're done.</p>
      <AuthNotice />

      {/* Book titles come from the API, so wait for them (or show the error). */}
      {booksStatus === "loading" ? (
        <LoadingState message="Loading your books..." />
      ) : booksStatus === "error" ? (
        <ErrorState message={booksError} onRetry={reloadBooks} />
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <p>No borrowed books</p>
          <Link to="/books">Browse the catalog →</Link>
        </div>
      ) : (
        <div className="loan-list">
          {loans.map((loan) => {
            const book = findBookById(loan.bookId);
            if (!book) return null;

            // Overdue / due-soon status comes from the memoized sets in
            // useBorrowing, rather than being recalculated here.
            const isOverdue = overdueLoans.some((l) => l.bookId === loan.bookId);
            const isDueSoon = !isOverdue && dueSoonLoans.some((l) => l.bookId === loan.bookId);
            const dueDate = new Date(loan.dueDate);
            const today = new Date();
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysLeft = Math.round((dueDate - today) / msPerDay);
            const canRenew = loan.renewals < MAX_RENEWALS;

            return (
              <div className={`loan-row ${isOverdue ? "overdue" : ""}`} key={loan.bookId}>
                <div className="info">
                  <h3>
                    <Link to={`/books/${book.id}`}>{book.title}</Link>
                  </h3>
                  <p style={{ margin: "2px 0", color: "#666" }}>{book.author}</p>
                  <div className="dates">
                    <span>Borrowed: {formatDate(loan.borrowedOn)}</span>
                    <span className={isOverdue ? "overdue-text" : ""}>
                      Due: {formatDate(loan.dueDate)}{" "}
                      {isOverdue ? `(${Math.abs(daysLeft)} days overdue)` : `(${daysLeft} days left)`}
                    </span>
                    {/* Conditional rendering: due-soon badge */}
                    {isDueSoon && (
                      <span className="status-msg warning" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>
                        Due soon
                      </span>
                    )}
                  </div>
                </div>

                <div className="loan-actions">
                  {/* Conditional rendering: renewal limit message */}
                  {canRenew ? (
                    <button className="btn-small" onClick={() => renewBook(loan.bookId)}>
                      Renew ({MAX_RENEWALS - loan.renewals} left)
                    </button>
                  ) : (
                    <span className="status-msg warning" style={{ fontSize: "0.78rem", padding: "6px 10px" }}>
                      Book renewal is not available
                    </span>
                  )}
                  <button className="btn-small btn-return" onClick={() => returnBook(loan.bookId)}>
                    Return
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BorrowedBooks;
