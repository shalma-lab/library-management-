import React from "react";
import { Link } from "react-router-dom";

// Recommendations is a small, reusable "presentational" component: it
// just displays a row of book cards that were passed in as a prop. It
// doesn't calculate anything itself, so it can be reused on the Home
// page and on the full Recommendations page without duplicating logic.
function Recommendations({ title, books, getReason }) {
  return (
    <div>
      {title && <h2 className="page-title">{title}</h2>}
      <div className="rec-row">
        {books.map((book) => (
          <div className="rec-card" key={book.id}>
            <h4>{book.title}</h4>
            <p style={{ margin: "0", color: "#666", fontSize: "0.85rem" }}>{book.author}</p>
            <div className="rec-reason">
              {getReason ? getReason(book) : `Because you like ${book.category}`}
            </div>
            <Link className="view-link" to={`/books/${book.id}`}>
              View details →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Recommendations;
