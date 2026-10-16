import { useState, useEffect, useMemo, useCallback } from "react";
import { getBooks } from "../services/bookService";
import { getErrorMessage, isAbort } from "../services/apiClient";

// useBooks manages everything related to the book catalog itself:
// the list of books, title search, author search, category filtering,
// and availability filtering. Any component that needs book data or
// search/filter controls can use this hook (usually through LibraryContext,
// not directly).
function useBooks() {
  const [books, setBooks] = useState([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [availabilityOnly, setAvailabilityOnly] = useState(false);

  // Request state for the catalog fetch: "loading" | "success" | "error".
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Load the catalog from the REST API (GET /api/books) once on mount, and
  // again whenever reload() is called. The request is aborted if the
  // component unmounts, so a late response can never update stale state.
  // Searching/filtering below happens in memory -- no extra requests.
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");

    getBooks({ signal: controller.signal })
      .then((list) => {
        setBooks(list);
        setStatus("success");
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setError(getErrorMessage(err));
        setStatus("error");
      });

    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  // useMemo: list of category names, only recalculated when "books" changes.
  const categories = useMemo(() => {
    const unique = new Set(books.map((book) => book.category).filter(Boolean));
    return ["All", ...Array.from(unique).sort()];
  }, [books]);

  // useMemo: list of author names, only recalculated when "books" changes.
  const authors = useMemo(() => {
    const unique = new Set(books.map((book) => book.author).filter(Boolean));
    return ["All", ...Array.from(unique).sort()];
  }, [books]);

  // useMemo: the catalog after title search, author search, category
  // filtering, and availability filtering have all been applied.
  const filteredBooks = useMemo(() => {
    const title = titleQuery.trim().toLowerCase();
    const author = authorQuery.trim().toLowerCase();
    // The title box also matches ISBN (ignoring dashes), when a book has one.
    const isbnQuery = title.replace(/-/g, "");

    return books.filter((book) => {
      const matchesIsbn =
        isbnQuery && book.isbn && String(book.isbn).replace(/-/g, "").toLowerCase().includes(isbnQuery);
      const matchesTitle = !title || String(book.title || "").toLowerCase().includes(title) || Boolean(matchesIsbn);
      const matchesAuthor = !author || String(book.author || "").toLowerCase().includes(author);
      const matchesCategory = categoryFilter === "All" || book.category === categoryFilter;
      const matchesAvailability = !availabilityOnly || book.availableCopies > 0;
      return matchesTitle && matchesAuthor && matchesCategory && matchesAvailability;
    });
  }, [books, titleQuery, authorQuery, categoryFilter, availabilityOnly]);

  // useMemo: books that currently have at least one copy available.
  // This is the canonical "Available Books" calculation -- other
  // components (Home, Profile, etc.) should read this instead of
  // re-filtering "books" themselves.
  const availableBooks = useMemo(
    () => books.filter((book) => book.availableCopies > 0),
    [books]
  );

  // useCallback: look up a single book by id. Used by BookDetail and by
  // useBorrowing (through LibraryContext) to check availability.
  const findBookById = useCallback(
    (id) => books.find((book) => book.id === Number(id)),
    [books]
  );

  // useCallback: increase or decrease a book's available copies.
  // delta is +1 on return, -1 on borrow. Called by useBorrowing.
  const adjustAvailability = useCallback((bookId, delta) => {
    setBooks((prevBooks) =>
      prevBooks.map((book) =>
        book.id === bookId
          ? {
              ...book,
              availableCopies: Math.min(
                Math.max(book.availableCopies + delta, 0),
                book.totalCopies
              ),
            }
          : book
      )
    );
  }, []);

  // useCallback: reset every search/filter field back to its default.
  const resetFilters = useCallback(() => {
    setTitleQuery("");
    setAuthorQuery("");
    setCategoryFilter("All");
    setAvailabilityOnly(false);
  }, []);

  return {
    books,
    booksStatus: status,
    booksError: error,
    reloadBooks: reload,
    filteredBooks,
    availableBooks,
    categories,
    authors,
    titleQuery,
    setTitleQuery,
    authorQuery,
    setAuthorQuery,
    categoryFilter,
    setCategoryFilter,
    availabilityOnly,
    setAvailabilityOnly,
    resetFilters,
    findBookById,
    adjustAvailability,
  };
}

export default useBooks;
