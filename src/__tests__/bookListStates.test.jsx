import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Books from "../pages/Books";
import { LibraryProvider } from "../context/LibraryContext";
import { AuthProvider } from "../context/AuthContext";
import useLibraryStore from "../store/libraryStore";
import { ApiError } from "../services/apiClient";
import { initialBooks, initialMember } from "../data/sampleData";

// Experiment 1 — component test: loading and error states of the catalog,
// including that the "Try again" button really retries the request.

jest.mock("../services/bookService");
jest.mock("../services/memberService");
jest.mock("../services/recommendationService");
jest.mock("../services/authService");

const bookService = require("../services/bookService");
const memberService = require("../services/memberService");
const recommendationService = require("../services/recommendationService");
const authService = require("../services/authService");

const INITIAL_STATE = useLibraryStore.getState();

const renderBooksPage = () =>
  render(
    <MemoryRouter initialEntries={["/books"]}>
      <AuthProvider>
        <LibraryProvider>
          <Books />
        </LibraryProvider>
      </AuthProvider>
    </MemoryRouter>
  );

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

describe("Catalog loading and error states", () => {
  test("shows a loading state while the request is in flight", async () => {
    // Never resolves: the UI must stay in its loading state.
    bookService.getBooks.mockImplementation(() => new Promise(() => {}));
    renderBooksPage();

    expect(await screen.findByText("Loading books...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("No books found")).not.toBeInTheDocument();
    expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();
  });

  test("shows the API error and retries successfully via 'Try again'", async () => {
    bookService.getBooks.mockImplementationOnce(() =>
      Promise.reject(new ApiError("Catalog is down", { status: 500, kind: "http" }))
    );
    const user = userEvent.setup();
    renderBooksPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Catalog is down");
    expect(screen.queryByText(/view details/i)).not.toBeInTheDocument();

    // The retry re-issues the request; this time the API answers.
    bookService.getBooks.mockImplementation(() => Promise.resolve(initialBooks));
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findAllByRole("link", { name: /view details/i })).toHaveLength(
      initialBooks.length
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
