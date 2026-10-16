import React from "react";
import { Link } from "react-router-dom";

function BookCard({ book }) {
  const isAvailable = book.availableCopies > 0;

  return (
    <div className="book-card">
      <span className="category">{book.category}</span>
      <h3>{book.title}</h3>
      <p className="author">by {book.author}</p>

      <div className="meta-row">
        <span>⭐ {book.rating}</span>
        <span className={`availability ${isAvailable ? "yes" : "no"}`}>
          {isAvailable ? `${book.availableCopies} available` : "Checked out"}
        </span>
      </div>

      <Link className="view-link" to={`/books/${book.id}`}>
        View details →
      </Link>
    </div>
  );
}

export default BookCard;
