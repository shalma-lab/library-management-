import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import BookDetail from "../pages/BookDetail";
import BorrowedBooks from "../pages/BorrowedBooks";
import { LibraryProvider } from "../context/LibraryContext";
import { AuthProvider } from "../context/AuthContext";
import useLibraryStore from "../store/libraryStore";
import { initialBooks, initialMember, MAX_RENEWALS } from "../data/sampleData";

// Experiment 1 — component test: the borrowing components.
// Covers borrow (BookDetail), return and renew (BorrowedBooks), and the
// availability status a book shows when it is out on loan.

jest.mock("../services/bookService");
jest.mock("../services/memberService");
jest.mock("../services/recommendationService");
jest.mock("../services/authService");

const bookService = require("../services/bookService");
const memberService = require("../services/memberService");
const recommendationService = require("../services/recommendationService");
const authService = require("../services/authService");

const INITIAL_STATE = useLibraryStore.getState();

// Real routes, because BookDetail reads the book id from the URL.
const renderPage = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <LibraryProvider>
          <Routes>
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/borrowed" element={<BorrowedBooks />} />
          </Routes>
        </LibraryProvider>
      </AuthProvider>
    </MemoryRouter>
  );

const store = () => useLibraryStore.getState();
const copiesOf = (id) => store().books.find((b) => b.id === id)?.availableCopies;
const isOnLoan = (id) => store().loans.some((l) => l.bookId === id);

beforeEach(() => {
  window.localStorage.clear();
  bookService.getBooks.mockImplementation(() => Promise.resolve(initialBooks));
  bookService.getBook.mockImplementation((id) => {
    const found = initialBooks.find((b) => String(b.id) === String(id));
    return found
      ? Promise.resolve(found)
      : Promise.reject(Object.assign(new Error("not found"), { status: 404 }));
  });
  bookService.getRelatedBooks.mockImplementation(() => Promise.resolve([]));
  memberService.getMember.mockImplementation(() => Promise.resolve({ ...initialMember }));
  recommendationService.getRecommendations.mockImplementation(() => Promise.resolve([]));
  authService.restoreSession.mockResolvedValue(null);
  authService.login.mockResolvedValue({ ...initialMember });
  authService.logout.mockResolvedValue(undefined);
  useLibraryStore.setState(INITIAL_STATE);
});

// A book that can actually be borrowed: copies left and not already on loan.
const borrowableBook = initialBooks.find(
  (b) => b.availableCopies > 0 && !INITIAL_STATE.loans.some((l) => l.bookId === b.id)
);
// A book that is out of stock and not on the member's shelf.
const checkedOutBook = initialBooks.find(
  (b) => !(b.availableCopies > 0) && !INITIAL_STATE.loans.some((l) => l.bookId === b.id)
);

describe("Borrowing — borrow", () => {
  test("borrowing a book adds a loan and reduces the available copies", async () => {
    const user = userEvent.setup();
    renderPage(`/books/${borrowableBook.id}`);

    const button = await screen.findByRole("button", { name: /borrow this book/i });
    const before = copiesOf(borrowableBook.id);

    await user.click(button);

    expect(isOnLoan(borrowableBook.id)).toBe(true);
    expect(copiesOf(borrowableBook.id)).toBe(before - 1);
    expect(screen.getByText(/you already have this book borrowed/i)).toBeInTheDocument();
    expect(screen.getByText("Book borrowed successfully")).toBeInTheDocument();

    // The detail page shows the live copy count from the catalog.
    expect(
      screen.getByText(`${before - 1} / ${borrowableBook.totalCopies} available`)
    ).toBeInTheDocument();
  });

  test("a checked-out book cannot be borrowed (availability status)", async () => {
    expect(checkedOutBook).toBeDefined();
    renderPage(`/books/${checkedOutBook.id}`);

    expect(await screen.findByText(/book currently unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place a hold/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /borrow this book/i })).not.toBeInTheDocument();
    expect(isOnLoan(checkedOutBook.id)).toBe(false);
  });
});

describe("Borrowing — renew and return", () => {
  test("renewing pushes the due date out and uses up a renewal", async () => {
    const user = userEvent.setup();
    renderPage("/borrowed");

    const renewButtons = await screen.findAllByRole("button", {
      name: new RegExp(`^renew \\(${MAX_RENEWALS} left\\)$`, "i"),
    });
    expect(renewButtons.length).toBe(store().loans.length);

    const loanBefore = store().loans[0];
    const dueBefore = new Date(loanBefore.dueDate).getTime();

    await user.click(renewButtons[0]);

    const loanAfter = store().loans[0];
    expect(loanAfter.renewals).toBe(loanBefore.renewals + 1);
    expect(new Date(loanAfter.dueDate).getTime()).toBeGreaterThan(dueBefore);
    expect(
      screen.getByRole("button", { name: new RegExp(`^renew \\(${MAX_RENEWALS - 1} left\\)$`, "i") })
    ).toBeInTheDocument();
  });

  test("returning a book clears the loan and gives the copy back", async () => {
    const user = userEvent.setup();
    renderPage("/borrowed");

    const returnButtons = await screen.findAllByRole("button", { name: /^return$/i });
    expect(returnButtons).toHaveLength(store().loans.length);

    const loan = store().loans[0];
    const copiesBefore = copiesOf(loan.bookId);

    await user.click(returnButtons[0]);

    expect(isOnLoan(loan.bookId)).toBe(false);
    expect(store().loans).toHaveLength(INITIAL_STATE.loans.length - 1);
    expect(copiesOf(loan.bookId)).toBe(copiesBefore + 1);
    expect(store().history.some((h) => h.bookId === loan.bookId)).toBe(true);
    expect(screen.getAllByRole("button", { name: /^return$/i })).toHaveLength(
      INITIAL_STATE.loans.length - 1
    );
  });
});
