import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Books from "../pages/Books";
import { LibraryProvider } from "../context/LibraryContext";
import { AuthProvider } from "../context/AuthContext";
import useLibraryStore from "../store/libraryStore";
import { initialBooks, initialMember } from "../data/sampleData";

// Experiment 1 — component test: the book list, including search and
// category filtering, plus the "no results" empty state.

jest.mock("../services/bookService");
jest.mock("../services/memberService");
jest.mock("../services/recommendationService");
jest.mock("../services/authService");

const bookService = require("../services/bookService");
const memberService = require("../services/memberService");
const recommendationService = require("../services/recommendationService");
const authService = require("../services/authService");

const INITIAL_STATE = useLibraryStore.getState();

const renderBooksPage = async () => {
  render(
    <MemoryRouter initialEntries={["/books"]}>
      <AuthProvider>
        <LibraryProvider>
          <Books />
        </LibraryProvider>
      </AuthProvider>
    </MemoryRouter>
  );
  // Resolves once the catalog has loaded (the list only renders cards then).
  await screen.findAllByRole("link", { name: /view details/i });
};

const visibleCards = () => screen.getAllByRole("link", { name: /view details/i });

beforeEach(() => {
  window.localStorage.clear();
  bookService.getBooks.mockImplementation(() => Promise.resolve(initialBooks));
  bookService.getBook.mockImplementation(() => Promise.resolve(initialBooks[0]));
  bookService.getRelatedBooks.mockImplementation(() => Promise.resolve([]));
  memberService.getMember.mockImplementation(() => Promise.resolve({ ...initialMember }));
  recommendationService.getRecommendations.mockImplementation(() => Promise.resolve([]));
  authService.restoreSession.mockResolvedValue(null);
  authService.login.mockResolvedValue({ ...initialMember });
  authService.logout.mockResolvedValue(undefined);
  useLibraryStore.setState(INITIAL_STATE);
});

describe("BookList — search and filtering", () => {
  test("renders every book returned by the API", async () => {
    await renderBooksPage();

    expect(visibleCards()).toHaveLength(initialBooks.length);
    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The Hobbit" })).toBeInTheDocument();
  });

  test("filters by title as the member types", async () => {
    const user = userEvent.setup();
    await renderBooksPage();

    await user.type(screen.getByLabelText(/search by title or isbn/i), "Dune");

    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Circe" })).not.toBeInTheDocument();
    expect(visibleCards()).toHaveLength(1);
  });

  test("filters by author", async () => {
    const user = userEvent.setup();
    await renderBooksPage();

    await user.type(screen.getByLabelText(/search by author/i), "Tolkien");

    expect(screen.getByRole("heading", { name: "The Hobbit" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dune" })).not.toBeInTheDocument();
    expect(visibleCards()).toHaveLength(1);
  });

  test("filters by category", async () => {
    const user = userEvent.setup();
    await renderBooksPage();

    await user.selectOptions(screen.getByLabelText(/filter by category/i), "Fantasy");

    const fantasy = initialBooks.filter((b) => b.category === "Fantasy");
    expect(fantasy.length).toBeGreaterThan(0);
    expect(visibleCards()).toHaveLength(fantasy.length);
    fantasy.forEach((book) => {
      expect(screen.getByRole("heading", { name: book.title })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Dune" })).not.toBeInTheDocument();
  });

  test("filters to available copies only", async () => {
    const user = userEvent.setup();
    await renderBooksPage();

    await user.click(screen.getByLabelText(/available only/i));

    const available = initialBooks.filter((b) => b.availableCopies > 0);
    const unavailable = initialBooks.filter((b) => !(b.availableCopies > 0));
    expect(visibleCards()).toHaveLength(available.length);
    expect(unavailable.length).toBeGreaterThan(0);
    unavailable.forEach((book) => {
      expect(screen.queryByRole("heading", { name: book.title })).not.toBeInTheDocument();
    });
  });

  test("shows the empty state when nothing matches, and Clear filters restores the list", async () => {
    const user = userEvent.setup();
    await renderBooksPage();

    await user.type(screen.getByLabelText(/search by title or isbn/i), "zzzznotabook");

    const empty = screen.getByText("No books found").closest(".empty-state");
    expect(within(empty).getByText(/try a different search/i)).toBeInTheDocument();

    await user.click(within(empty).getByRole("button", { name: /clear filters/i }));

    expect(visibleCards()).toHaveLength(initialBooks.length);
    expect(screen.queryByText("No books found")).not.toBeInTheDocument();
  });
});
