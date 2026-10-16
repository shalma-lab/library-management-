import React, { useRef, useEffect } from "react";
import BookCard from "./BookCard";
import SearchBar from "./SearchBar";
import FilterPanel from "./FilterPanel";
import { useLibrary } from "../context/LibraryContext";
import { LoadingState, ErrorState } from "./Status";

// BookList reads books + search/filter state straight from LibraryContext,
// then hands the pieces down to the reusable SearchBar and FilterPanel
// components as props.
function BookList() {
  const {
    booksStatus,
    booksError,
    reloadBooks,
    filteredBooks,
    categories,
    titleQuery,
    setTitleQuery,
    authorQuery,
    setAuthorQuery,
    categoryFilter,
    setCategoryFilter,
    availabilityOnly,
    setAvailabilityOnly,
    resetFilters,
  } = useLibrary();

  // useRef + useEffect: automatically focus the title search box when
  // this list first appears on screen.
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  return (
    <div>
      <div className="controls">
        <SearchBar
          titleQuery={titleQuery}
          onTitleChange={setTitleQuery}
          authorQuery={authorQuery}
          onAuthorChange={setAuthorQuery}
          inputRef={titleInputRef}
        />
        <FilterPanel
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          availabilityOnly={availabilityOnly}
          onAvailabilityChange={setAvailabilityOnly}
          onReset={resetFilters}
        />
      </div>

      {/* Loading / error come first, so "No books found" never flashes
          before the first request has finished. */}
      {booksStatus === "loading" ? (
        <LoadingState message="Loading books..." />
      ) : booksStatus === "error" ? (
        <ErrorState message={booksError} onRetry={reloadBooks} />
      ) : filteredBooks.length === 0 ? (
        <div className="empty-state">
          <p>No books found</p>
          <p style={{ fontSize: "0.9rem" }}>Try a different search, or clear the filters.</p>
          <button className="btn-secondary" style={{ marginTop: "12px" }} onClick={resetFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="book-grid">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

export default BookList;
