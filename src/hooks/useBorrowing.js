import { useState, useEffect, useMemo, useCallback } from "react";
import { initialLoans, initialHistory, LOAN_DAYS, MAX_RENEWALS } from "../data/sampleData";

const STORAGE_KEY = "athenaeum_borrowing_data";
const DUE_SOON_DAYS = 3;

const daysBetween = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

// useBorrowing manages everything related to borrowing: the member's
// currently borrowed books, due dates, renewals, holds, and reading
// history. It talks to the book catalog only through the two small
// functions passed in (getBook / adjustAvailability), which normally
// come from useBooks via LibraryContext.
function useBorrowing({ getBook, adjustAvailability } = {}) {
  const [loans, setLoans] = useState([]);
  const [history, setHistory] = useState([]);
  const [holds, setHolds] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastMessage, setLastMessage] = useState("");

  // useEffect: on the very first render, try to load previously saved
  // borrowing data from browser storage. If there isn't any yet, fall
  // back to the sample starting data.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLoans(parsed.loans || []);
        setHistory(parsed.history || []);
        setHolds(parsed.holds || []);
      } else {
        setLoans(initialLoans);
        setHistory(initialHistory);
        setHolds([]);
      }
    } catch (error) {
      // Storage might be unavailable (private browsing, etc). Fall back
      // to sample data instead of crashing the app.
      setLoans(initialLoans);
      setHistory(initialHistory);
      setHolds([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // useEffect: every time loans/history/holds change, save them back to
  // browser storage so the member's activity survives a page refresh.
  // The isHydrated check stops this from running before the data above
  // has even finished loading.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ loans, history, holds })
      );
    } catch (error) {
      // Ignore storage errors (e.g. storage full or disabled).
    }
  }, [loans, history, holds, isHydrated]);

  const isBorrowed = useCallback((bookId) => loans.some((loan) => loan.bookId === bookId), [loans]);
  const isOnHold = useCallback((bookId) => holds.some((hold) => hold.bookId === bookId), [holds]);

  // useMemo: loans that are already past their due date.
  const overdueLoans = useMemo(() => {
    const today = new Date();
    return loans.filter((loan) => new Date(loan.dueDate) < today);
  }, [loans]);

  // useMemo: loans that are due within the next few days (but not overdue yet).
  const dueSoonLoans = useMemo(() => {
    const today = new Date();
    return loans.filter((loan) => {
      const due = new Date(loan.dueDate);
      const daysLeft = daysBetween(today, due);
      return daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS;
    });
  }, [loans]);

  // useMemo: the member's currently borrowed books, joined with their
  // full book details. This is the canonical "Borrowed Books" list --
  // components should read this instead of re-joining loans + books
  // themselves.
  const borrowedBooks = useMemo(() => {
    if (!getBook) return [];
    return loans
      .map((loan) => {
        const book = getBook(loan.bookId);
        return book ? { ...book, loan } : null;
      })
      .filter(Boolean);
  }, [loans, getBook]);

  // useMemo: simple reading statistics built from the returned-books history.
  const readingStats = useMemo(() => {
    const totalRead = history.length;
    const categoryCounts = {};

    history.forEach((entry) => {
      const book = getBook ? getBook(entry.bookId) : null;
      if (book) {
        categoryCounts[book.category] = (categoryCounts[book.category] || 0) + 1;
      }
    });

    let favoriteCategory = "—";
    let highestCount = 0;
    Object.entries(categoryCounts).forEach(([category, count]) => {
      if (count > highestCount) {
        favoriteCategory = category;
        highestCount = count;
      }
    });

    const totalDaysKept = history.reduce(
      (sum, entry) => sum + daysBetween(new Date(entry.borrowedOn), new Date(entry.returnedOn)),
      0
    );
    const avgDaysKept = totalRead ? Math.round(totalDaysKept / totalRead) : 0;

    return {
      totalRead,
      favoriteCategory,
      avgDaysKept,
      currentlyBorrowed: loans.length,
      activeHolds: holds.length,
      // Total borrowed = everything ever checked out (returned + still out).
      totalBorrowed: totalRead + loans.length,
    };
  }, [history, loans, holds, getBook]);

  // useCallback: borrow a book. Checks the book exists, isn't already
  // borrowed by this member, and has a copy available.
  const borrowBook = useCallback(
    (bookId) => {
      const book = getBook ? getBook(bookId) : null;

      if (!book) {
        setLastMessage("Book currently unavailable");
        return { success: false, message: "Book currently unavailable" };
      }
      if (loans.some((loan) => loan.bookId === bookId)) {
        setLastMessage("You already have this book borrowed");
        return { success: false, message: "You already have this book borrowed" };
      }
      if (book.availableCopies <= 0) {
        setLastMessage("Book currently unavailable");
        return { success: false, message: "Book currently unavailable" };
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + LOAN_DAYS);

      setLoans((prev) => [
        ...prev,
        { bookId, borrowedOn: new Date().toISOString(), dueDate: dueDate.toISOString(), renewals: 0 },
      ]);
      setHolds((prev) => prev.filter((hold) => hold.bookId !== bookId));
      if (adjustAvailability) adjustAvailability(bookId, -1);

      setLastMessage("Book borrowed successfully");
      return { success: true, message: "Book borrowed successfully" };
    },
    [loans, getBook, adjustAvailability]
  );

  // useCallback: return a borrowed book and move it into reading history.
  const returnBook = useCallback(
    (bookId) => {
      const loan = loans.find((l) => l.bookId === bookId);
      if (!loan) {
        setLastMessage("No borrowed books");
        return { success: false, message: "No borrowed books" };
      }

      setLoans((prev) => prev.filter((l) => l.bookId !== bookId));
      setHistory((prev) => [
        ...prev,
        { bookId, borrowedOn: loan.borrowedOn, returnedOn: new Date().toISOString() },
      ]);
      if (adjustAvailability) adjustAvailability(bookId, 1);

      setLastMessage("Book returned successfully");
      return { success: true, message: "Book returned successfully" };
    },
    [loans, adjustAvailability]
  );

  // useCallback: renew a borrowed book, as long as the renewal limit
  // hasn't been reached yet.
  const renewBook = useCallback(
    (bookId) => {
      const loan = loans.find((l) => l.bookId === bookId);

      if (!loan || loan.renewals >= MAX_RENEWALS) {
        setLastMessage("Book renewal is not available");
        return { success: false, message: "Book renewal is not available" };
      }

      setLoans((prev) =>
        prev.map((l) => {
          if (l.bookId !== bookId) return l;
          const today = new Date();
          const currentDue = new Date(l.dueDate);
          const base = currentDue < today ? today : currentDue;
          base.setDate(base.getDate() + LOAN_DAYS);
          return { ...l, dueDate: base.toISOString(), renewals: l.renewals + 1 };
        })
      );

      setLastMessage("Book renewed successfully");
      return { success: true, message: "Book renewed successfully" };
    },
    [loans]
  );

  // useCallback: place a hold on a book that's currently checked out.
  const placeHold = useCallback(
    (bookId) => {
      if (holds.some((hold) => hold.bookId === bookId)) {
        setLastMessage("You are already on the hold list for this book");
        return { success: false, message: "You are already on the hold list for this book" };
      }
      setHolds((prev) => [...prev, { bookId, placedOn: new Date().toISOString() }]);
      setLastMessage("Hold placed successfully");
      return { success: true, message: "Hold placed successfully" };
    },
    [holds]
  );

  // useCallback: wipe all borrowing data (loans, history, holds) and
  // clear it from browser storage too. Handy for a "reset demo" button.
  const clearBorrowing = useCallback(() => {
    setLoans([]);
    setHistory([]);
    setHolds([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors.
    }
    setLastMessage("Borrowing data cleared");
  }, []);

  return {
    loans,
    history,
    holds,
    overdueLoans,
    dueSoonLoans,
    borrowedBooks,
    readingStats,
    isBorrowed,
    isOnHold,
    borrowBook,
    returnBook,
    renewBook,
    placeHold,
    clearBorrowing,
    lastMessage,
  };
}

export default useBorrowing;
