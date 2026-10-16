import React from "react";
import BookList from "../components/BookList";
import { useLibrary } from "../context/LibraryContext";

function Books() {
  const { books, filteredBooks, booksStatus } = useLibrary();

  return (
    <div className="container">
      <h1 className="page-title">All Books</h1>
      <p className="page-subtitle">
        {booksStatus === "success"
          ? `${filteredBooks.length} of ${books.length} titles shown`
          : "Browse and search the catalog."}
      </p>

      <BookList />
    </div>
  );
}

export default Books;
