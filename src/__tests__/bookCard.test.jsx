import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import BookCard from "../components/BookCard";
import { initialBooks } from "../data/sampleData";

// Experiment 1 — component test: the reusable book card.
// Covers the card's content, its availability status (available vs checked
// out) and its details link.

const availableBook = initialBooks.find((b) => b.availableCopies > 0);
const checkedOutBook = { ...initialBooks[0], id: 999, title: "Shelved Away", availableCopies: 0 };

const renderCard = (book) =>
  render(
    <MemoryRouter>
      <BookCard book={book} />
    </MemoryRouter>
  );

describe("BookCard", () => {
  test("renders the title, author, category and rating", () => {
    renderCard(availableBook);

    expect(screen.getByRole("heading", { name: availableBook.title })).toBeInTheDocument();
    expect(screen.getByText(`by ${availableBook.author}`)).toBeInTheDocument();
    expect(screen.getByText(availableBook.category)).toBeInTheDocument();
    expect(screen.getByText(`⭐ ${availableBook.rating}`)).toBeInTheDocument();
  });

  test("shows how many copies are available", () => {
    renderCard(availableBook);

    const status = screen.getByText(`${availableBook.availableCopies} available`);
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("yes");
  });

  test("shows 'Checked out' when there are no copies left", () => {
    renderCard(checkedOutBook);

    const status = screen.getByText("Checked out");
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("no");
    expect(status).not.toHaveClass("yes");
  });

  test("links to the book's detail page", () => {
    renderCard(availableBook);

    const link = screen.getByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute("href", `/books/${availableBook.id}`);
  });
});
