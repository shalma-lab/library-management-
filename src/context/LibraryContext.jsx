import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import useLibraryStore from "../store/libraryStore";
import { initialMember } from "../data/sampleData";
import { useAuth } from "./AuthContext";
import useRecommendations from "../hooks/useRecommendations";

// LibraryContext continues to expose the same shape that existing pages
// already consume via useLibrary(). Internally it is now backed by the
// Zustand global store (Experiment 6) instead of multiple local-state hooks.
const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  // Subscribe to the pieces of the store that the context value needs.
  // Using individual selectors keeps re-renders focused.
  const books = useLibraryStore((s) => s.books);
  const booksStatus = useLibraryStore((s) => s.booksStatus);
  const booksError = useLibraryStore((s) => s.booksError);
  const titleQuery = useLibraryStore((s) => s.titleQuery);
  const authorQuery = useLibraryStore((s) => s.authorQuery);
  const categoryFilter = useLibraryStore((s) => s.categoryFilter);
  const availabilityOnly = useLibraryStore((s) => s.availabilityOnly);
  const loans = useLibraryStore((s) => s.loans);
  const history = useLibraryStore((s) => s.history);
  const holds = useLibraryStore((s) => s.holds);
  const lastMessage = useLibraryStore((s) => s.lastMessage);
  const actionLoading = useLibraryStore((s) => s.actionLoading);
  const member = useLibraryStore((s) => s.member);
  const memberStatus = useLibraryStore((s) => s.memberStatus);
  const memberError = useLibraryStore((s) => s.memberError);
  const memberIdFromStore = useLibraryStore((s) => s.memberId);

  // Actions (stable references from the store)
  const fetchBooks = useLibraryStore((s) => s.fetchBooks);
  const setTitleQuery = useLibraryStore((s) => s.setTitleQuery);
  const setAuthorQuery = useLibraryStore((s) => s.setAuthorQuery);
  const setCategoryFilter = useLibraryStore((s) => s.setCategoryFilter);
  const setAvailabilityOnly = useLibraryStore((s) => s.setAvailabilityOnly);
  const findBookById = useLibraryStore((s) => s.findBookById);
  const adjustAvailability = useLibraryStore((s) => s.adjustAvailability);
  const fetchMember = useLibraryStore((s) => s.fetchMember);
  const setMemberId = useLibraryStore((s) => s.setMemberId);
  const borrowBook = useLibraryStore((s) => s.borrowBook);
  const returnBook = useLibraryStore((s) => s.returnBook);
  const renewBook = useLibraryStore((s) => s.renewBook);
  const placeHold = useLibraryStore((s) => s.placeHold);
  const clearBorrowing = useLibraryStore((s) => s.clearBorrowing);
  const getFilteredBooks = useLibraryStore((s) => s.getFilteredBooks);
  const getCategories = useLibraryStore((s) => s.getCategories);
  const getAuthors = useLibraryStore((s) => s.getAuthors);
  const isBorrowed = useLibraryStore((s) => s.isBorrowed);
  const isOnHold = useLibraryStore((s) => s.isOnHold);
  const getOverdueLoans = useLibraryStore((s) => s.getOverdueLoans);
  const getDueSoonLoans = useLibraryStore((s) => s.getDueSoonLoans);
  const getBorrowedBooks = useLibraryStore((s) => s.getBorrowedBooks);
  const getReadingStats = useLibraryStore((s) => s.getReadingStats);

  // Auth drives which member id we load
  const { member: authMember, isAuthenticated } = useAuth();
  const activeMemberId = authMember?.id || initialMember.id;

  // Keep store memberId in sync with auth
  useEffect(() => {
    if (activeMemberId !== memberIdFromStore) {
      setMemberId(activeMemberId);
    }
  }, [activeMemberId, memberIdFromStore, setMemberId]);

  // Load catalog once on mount (and when explicitly reloaded)
  useEffect(() => {
    const controller = new AbortController();
    fetchBooks(controller.signal);
    return () => controller.abort();
  }, [fetchBooks]);

  // Load / reload member whenever the active id changes -- and whenever the
  // sign-in state changes. Logging out clears the member from the store
  // (clearMemberState), and the id itself often stays the same (the demo
  // member is also the guest member), so without `isAuthenticated` in the
  // dependency list nothing would ever refetch and the Profile page would be
  // stuck on its loading state after a logout.
  useEffect(() => {
    const controller = new AbortController();
    fetchMember(activeMemberId, controller.signal);
    return () => controller.abort();
  }, [activeMemberId, isAuthenticated, fetchMember]);

  // Recommendations still use the existing dedicated hook (API-backed)
  const favoriteCategories = useMemo(
    () => member?.favoriteCategories ?? [],
    [member]
  );
  const seenIds = useMemo(
    () => [
      ...new Set([
        ...loans.map((l) => l.bookId),
        ...history.map((h) => h.bookId),
      ]),
    ],
    [loans, history]
  );
  const readCategories = useMemo(
    () =>
      [
        ...new Set(
          history
            .map((e) => findBookById(e.bookId)?.category)
            .filter(Boolean)
        ),
      ],
    [history, findBookById]
  );

  const recsApi = useRecommendations(
    member ? activeMemberId : null,
    seenIds,
    readCategories
  );

  const localRecommendedBooks = useMemo(() => {
    const likedCategories = new Set([
      ...history.map((entry) => findBookById(entry.bookId)?.category),
      ...favoriteCategories,
    ]);
    const alreadySeen = new Set([
      ...loans.map((loan) => loan.bookId),
      ...history.map((entry) => entry.bookId),
    ]);
    return books
      .filter(
        (book) =>
          likedCategories.has(book.category) && !alreadySeen.has(book.id)
      )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6);
  }, [books, findBookById, history, loans, favoriteCategories]);

  // Derived values that components already expect.
  // The store getters read their input from the store itself, which ESLint
  // cannot see from the callback body -- so the raw slices listed in each
  // dependency array below are what actually has to trigger the recompute.
  const filteredBooks = useMemo(
    () => getFilteredBooks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getFilteredBooks, books, titleQuery, authorQuery, categoryFilter, availabilityOnly]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => getCategories(), [getCategories, books]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const authors = useMemo(() => getAuthors(), [getAuthors, books]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overdueLoans = useMemo(() => getOverdueLoans(), [getOverdueLoans, loans]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dueSoonLoans = useMemo(() => getDueSoonLoans(), [getDueSoonLoans, loans]);
  const borrowedBooks = useMemo(
    () => getBorrowedBooks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getBorrowedBooks, loans, books]
  );
  const readingStats = useMemo(
    () => getReadingStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getReadingStats, history, books]
  );

  const availableBooks = useMemo(
    () => books.filter((book) => (book.availableCopies || 0) > 0),
    [books]
  );

  // Wrapped in useCallback so the shared context value below can depend on
  // them without being rebuilt on every render.
  const resetFilters = useCallback(() => {
    setTitleQuery("");
    setAuthorQuery("");
    setCategoryFilter("All");
    setAvailabilityOnly(false);
  }, [setTitleQuery, setAuthorQuery, setCategoryFilter, setAvailabilityOnly]);

  // Returns the in-flight fetch, so callers (e.g. the Manage page) can await
  // a refetch after a create/update/delete instead of racing the list.
  const reloadBooks = useCallback(() => {
    const controller = new AbortController();
    return fetchBooks(controller.signal);
  }, [fetchBooks]);

  const reloadMember = useCallback(() => {
    const controller = new AbortController();
    fetchMember(activeMemberId, controller.signal);
  }, [activeMemberId, fetchMember]);

  // Preserve the exact shape that every existing page / component expects.
  const value = useMemo(
    () => ({
      // Member
      member,
      memberStatus,
      memberError,
      reloadMember,

      // Recommendations
      recommendedBooks: recsApi.books,
      recommendationsStatus: member ? recsApi.status : memberStatus,
      recommendationsError: member ? recsApi.error : memberError,
      reloadRecommendations: member ? recsApi.retry : reloadMember,
      localRecommendedBooks,

      // Books (catalog + filters) – same names as old useBooks
      books,
      booksStatus,
      booksError,
      reloadBooks,
      status: booksStatus,
      error: booksError,
      reload: reloadBooks,
      titleQuery,
      setTitleQuery,
      authorQuery,
      setAuthorQuery,
      categoryFilter,
      setCategoryFilter,
      availabilityOnly,
      setAvailabilityOnly,
      categories,
      authors,
      filteredBooks,
      availableBooks,
      resetFilters,
      findBookById,
      adjustAvailability,

      // Borrowing – same names as old useBorrowing
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
      actionLoading,
    }),
    [
      member,
      memberStatus,
      memberError,
      recsApi,
      localRecommendedBooks,
      books,
      booksStatus,
      booksError,
      titleQuery,
      setTitleQuery,
      authorQuery,
      setAuthorQuery,
      categoryFilter,
      setCategoryFilter,
      availabilityOnly,
      setAvailabilityOnly,
      categories,
      authors,
      filteredBooks,
      availableBooks,
      resetFilters,
      reloadBooks,
      reloadMember,
      findBookById,
      adjustAvailability,
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
      actionLoading,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside a <LibraryProvider>");
  }
  return context;
}

export default LibraryContext;
