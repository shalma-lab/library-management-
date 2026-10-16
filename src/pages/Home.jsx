import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import BookCard from "../components/BookCard";
import RecommendationsSection from "../components/RecommendationsSection";
import { LoadingState, ErrorState } from "../components/Status";
import { useLibrary } from "../context/LibraryContext";

function Home() {
  const { books, availableBooks, overdueLoans, booksStatus, booksError, reloadBooks } = useLibrary();
  const loaded = booksStatus === "success";

  const featuredBooks = useMemo(
    () => [...books].sort((a, b) => b.rating - a.rating).slice(0, 4),
    [books]
  );

  return (
    <div className="container">
      <section className="hero">
        <h1>One Library. Endless Knowledge.</h1>
        <p>
          Discover, borrow, and manage books from a single, beautifully designed
          digital library — inspired by the National Digital Library of India.
        </p>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="num">{loaded ? books.length : "–"}</div>
            <div className="label">Titles in Catalog</div>
          </div>
          <div className="hero-stat">
            <div className="num">{loaded ? availableBooks.length : "–"}</div>
            <div className="label">Available Now</div>
          </div>
          <div className="hero-stat">
            <div className="num">{overdueLoans.length}</div>
            <div className="label">Overdue on Account</div>
          </div>
        </div>

        <Link to="/books">
          <button className="btn">Browse All Books →</button>
        </Link>
      </section>

      <h2 className="page-title">Featured Books</h2>
      <p className="page-subtitle">Popular titles hand-picked from the catalog.</p>

      {booksStatus === "loading" ? (
        <LoadingState message="Loading books..." />
      ) : booksStatus === "error" ? (
        <ErrorState message={booksError} onRetry={reloadBooks} />
      ) : (
        <div className="book-grid">
          {featuredBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      <div style={{ marginTop: "48px" }}>
        <RecommendationsSection title="Recommended for you" />
      </div>
    </div>
  );
}

export default Home;
