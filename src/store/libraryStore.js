/**
 * Global Library Store (Experiment 6)
 *
 * Implemented with Zustand + persist middleware.
 * Manages: books catalog, search/filter UI state, borrowed loans,
 * reading history, holds, member profile, loading/error flags,
 * and action results (borrow / return / renew / hold).
 *
 * Chosen library: Zustand
 * Reason: No prior global state library existed. Zustand is lightweight,
 * has first-class persist middleware that matches the app's existing
 * localStorage pattern for borrowing data, requires no Provider boilerplate
 * for this SPA, and keeps the surface area small while still supporting
 * middleware-style action monitoring.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getBooks } from "../services/bookService";
import { getMember } from "../services/memberService";
import { getErrorMessage, isAbort } from "../services/apiClient";
import {
  initialLoans,
  initialHistory,
  LOAN_DAYS,
  MAX_RENEWALS,
  initialMember,
} from "../data/sampleData";

const STORAGE_KEY = "athenaeum_library_store_v1";
const DUE_SOON_DAYS = 3;

const daysBetween = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));

// ---------- development-only action logger (middleware-style) ----------
const libraryLogger = (config) => (set, get, api) =>
  config(
    (...args) => {
      // During the very first hydrate zustand calls this before the store
      // has finished creating itself, so getState() can still be undefined.
      const prev = get() || {};
      set(...args);
      const next = get() || {};
      if (process.env.NODE_ENV === "development") {
        const changed = Object.keys(next).filter(
          (k) => prev[k] !== next[k] && typeof next[k] !== "function"
        );
        if (changed.length) {
          // Avoid logging member personal details or large book arrays
          const safe = {};
          changed.forEach((k) => {
            if (["member", "books", "filteredBooks"].includes(k)) {
              safe[k] = Array.isArray(next[k]) ? `[${next[k].length} items]` : next[k] ? "{…}" : next[k];
            } else if (k === "lastMessage" || k.endsWith("Status") || k.endsWith("Error") || k === "actionLoading") {
              safe[k] = next[k];
            } else if (["loans", "history", "holds"].includes(k)) {
              safe[k] = `[${(next[k] || []).length} records]`;
            }
          });
          if (Object.keys(safe).length) {
            // eslint-disable-next-line no-console
            console.info(
              `[LibraryStore ${new Date().toISOString()}]`,
              safe
            );
          }
        }
      }
    },
    get,
    api
  );

const useLibraryStore = create(
  libraryLogger(
    persist(
      (set, get) => ({
        // ===== A. Books =====
        books: [],
        // The catalog is fetched as soon as the provider mounts, so the very
        // first paint must already read as "loading". Starting at "idle"
        // would let the empty-state messages ("No books found" /
        // "No borrowed books" / "No reading history available") flash before
        // the request has even been issued.
        booksStatus: "loading", // idle | loading | success | error
        booksError: "",
        titleQuery: "",
        authorQuery: "",
        categoryFilter: "All",
        availabilityOnly: false,

        // ===== B. Borrowed / History / Holds =====
        loans: initialLoans,
        history: initialHistory,
        holds: [],
        lastMessage: "",
        actionLoading: false, // borrow / return / renew / hold in flight

        // ===== C. Member =====
        member: null,
        // Same reasoning as booksStatus: fetchMember runs on mount.
        memberStatus: "loading",
        memberError: "",
        memberId: initialMember.id,

        // ===== derived helpers (recomputed on demand via selectors) =====

        // ---------- Book actions ----------
        fetchBooks: async (signal) => {
          set({ booksStatus: "loading", booksError: "" });
          try {
            const list = await getBooks({ signal });
            set({ books: list, booksStatus: "success", booksError: "" });
          } catch (err) {
            if (isAbort(err)) return;
            set({ booksStatus: "error", booksError: getErrorMessage(err) });
          }
        },

        setTitleQuery: (q) => set({ titleQuery: q }),
        setAuthorQuery: (q) => set({ authorQuery: q }),
        setCategoryFilter: (c) => set({ categoryFilter: c }),
        setAvailabilityOnly: (v) => set({ availabilityOnly: !!v }),

        findBookById: (id) => {
          const num = Number(id);
          return get().books.find((b) => b.id === num) || null;
        },

        adjustAvailability: (bookId, delta) => {
          set((state) => ({
            books: state.books.map((b) =>
              b.id === bookId
                ? {
                    ...b,
                    availableCopies: Math.min(
                      Math.max((b.availableCopies || 0) + delta, 0),
                      b.totalCopies ?? Infinity
                    ),
                  }
                : b
            ),
          }));
        },

        // ---------- Member actions ----------
        fetchMember: async (id, signal) => {
          const memberId = id || get().memberId;
          set({ memberStatus: "loading", memberError: "", memberId });
          try {
            const member = await getMember(memberId, { signal });
            set({ member, memberStatus: "success", memberError: "" });
          } catch (err) {
            if (isAbort(err)) return;
            set({ memberStatus: "error", memberError: getErrorMessage(err), member: null });
          }
        },

        setMemberId: (id) => set({ memberId: id }),

        clearMemberState: () =>
          set({
            member: null,
            memberStatus: "idle",
            memberError: "",
            loans: [],
            history: [],
            holds: [],
            lastMessage: "",
          }),

        // ---------- Borrow / Return / Renew / Hold ----------
        borrowBook: (bookId) => {
          const state = get();
          if (state.actionLoading) {
            return { success: false, message: "Another operation is already in progress" };
          }
          const book = state.findBookById(bookId);
          if (!book) {
            set({ lastMessage: "Book currently unavailable" });
            return { success: false, message: "Book currently unavailable" };
          }
          if (state.loans.some((l) => l.bookId === bookId)) {
            set({ lastMessage: "You already have this book borrowed" });
            return { success: false, message: "You already have this book borrowed" };
          }
          if ((book.availableCopies || 0) <= 0) {
            set({ lastMessage: "Book currently unavailable" });
            return { success: false, message: "Book currently unavailable" };
          }

          set({ actionLoading: true });
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + LOAN_DAYS);

          set((s) => ({
            loans: [
              ...s.loans,
              {
                bookId,
                borrowedOn: new Date().toISOString(),
                dueDate: dueDate.toISOString(),
                renewals: 0,
              },
            ],
            holds: s.holds.filter((h) => h.bookId !== bookId),
            lastMessage: "Book borrowed successfully",
            actionLoading: false,
          }));
          get().adjustAvailability(bookId, -1);
          return { success: true, message: "Book borrowed successfully" };
        },

        returnBook: (bookId) => {
          const state = get();
          if (state.actionLoading) {
            return { success: false, message: "Another operation is already in progress" };
          }
          const loan = state.loans.find((l) => l.bookId === bookId);
          if (!loan) {
            set({ lastMessage: "No borrowed books" });
            return { success: false, message: "No borrowed books" };
          }

          set({ actionLoading: true });
          set((s) => ({
            loans: s.loans.filter((l) => l.bookId !== bookId),
            history: [
              ...s.history,
              {
                bookId,
                borrowedOn: loan.borrowedOn,
                returnedOn: new Date().toISOString(),
              },
            ],
            lastMessage: "Book returned successfully",
            actionLoading: false,
          }));
          get().adjustAvailability(bookId, 1);
          return { success: true, message: "Book returned successfully" };
        },

        renewBook: (bookId) => {
          const state = get();
          if (state.actionLoading) {
            return { success: false, message: "Another operation is already in progress" };
          }
          const loan = state.loans.find((l) => l.bookId === bookId);
          if (!loan || loan.renewals >= MAX_RENEWALS) {
            set({ lastMessage: "Book renewal is not available" });
            return { success: false, message: "Book renewal is not available" };
          }

          set({ actionLoading: true });
          set((s) => ({
            loans: s.loans.map((l) => {
              if (l.bookId !== bookId) return l;
              const today = new Date();
              const currentDue = new Date(l.dueDate);
              const base = currentDue < today ? today : currentDue;
              base.setDate(base.getDate() + LOAN_DAYS);
              return {
                ...l,
                dueDate: base.toISOString(),
                renewals: l.renewals + 1,
              };
            }),
            lastMessage: "Book renewed successfully",
            actionLoading: false,
          }));
          return { success: true, message: "Book renewed successfully" };
        },

        placeHold: (bookId) => {
          const state = get();
          if (state.actionLoading) {
            return { success: false, message: "Another operation is already in progress" };
          }
          if (state.holds.some((h) => h.bookId === bookId)) {
            set({ lastMessage: "You are already on the hold list for this book" });
            return {
              success: false,
              message: "You are already on the hold list for this book",
            };
          }
          // Optional: prevent hold if already borrowed by self
          if (state.loans.some((l) => l.bookId === bookId)) {
            set({ lastMessage: "You already have this book borrowed" });
            return { success: false, message: "You already have this book borrowed" };
          }

          set({ actionLoading: true });
          set((s) => ({
            holds: [...s.holds, { bookId, placedOn: new Date().toISOString() }],
            lastMessage: "Hold placed successfully",
            actionLoading: false,
          }));
          return { success: true, message: "Hold placed successfully" };
        },

        clearBorrowing: () => {
          set({
            loans: [],
            history: [],
            holds: [],
            lastMessage: "Borrowing data cleared",
          });
        },

        // ---------- derived getters (safe to call outside React) ----------
        getFilteredBooks: () => {
          const {
            books,
            titleQuery,
            authorQuery,
            categoryFilter,
            availabilityOnly,
          } = get();
          const t = (titleQuery || "").trim().toLowerCase();
          const a = (authorQuery || "").trim().toLowerCase();
          // The title box also matches ISBN (dashes ignored) when a book
          // has one -- same behaviour the in-memory filter always had.
          const isbnQuery = t.replace(/-/g, "");
          return books.filter((book) => {
            const matchesIsbn =
              isbnQuery &&
              book.isbn &&
              String(book.isbn).replace(/-/g, "").toLowerCase().includes(isbnQuery);
            const matchesTitle =
              !t || String(book.title || "").toLowerCase().includes(t) || Boolean(matchesIsbn);
            const matchesAuthor = !a || String(book.author || "").toLowerCase().includes(a);
            const matchesCategory =
              !categoryFilter || categoryFilter === "All" || book.category === categoryFilter;
            const matchesAvailability =
              !availabilityOnly || (book.availableCopies || 0) > 0;
            return matchesTitle && matchesAuthor && matchesCategory && matchesAvailability;
          });
        },

        getCategories: () => {
          const unique = new Set(
            get().books.map((b) => b.category).filter(Boolean)
          );
          return ["All", ...Array.from(unique).sort()];
        },

        getAuthors: () => {
          const unique = new Set(get().books.map((b) => b.author).filter(Boolean));
          return ["All", ...Array.from(unique).sort()];
        },

        isBorrowed: (bookId) => get().loans.some((l) => l.bookId === bookId),
        isOnHold: (bookId) => get().holds.some((h) => h.bookId === bookId),

        getOverdueLoans: () => {
          const today = new Date();
          return get().loans.filter((l) => new Date(l.dueDate) < today);
        },

        getDueSoonLoans: () => {
          const today = new Date();
          return get().loans.filter((l) => {
            const due = new Date(l.dueDate);
            const daysLeft = daysBetween(today, due);
            return daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS;
          });
        },

        getBorrowedBooks: () => {
          const { loans, findBookById } = get();
          return loans
            .map((loan) => {
              const book = findBookById(loan.bookId);
              return book ? { ...book, loan } : null;
            })
            .filter(Boolean);
        },

        // Reading statistics. The shape must stay identical to the one the
        // old useBorrowing hook exposed, because Profile (and anything else
        // consuming useLibrary()) reads favouriteCategory / avgDaysKept /
        // totalBorrowed off it.
        getReadingStats: () => {
          const { history, loans, holds, findBookById } = get();
          const totalRead = history.length;
          const categoryCounts = {};
          history.forEach((entry) => {
            const book = findBookById(entry.bookId);
            if (book?.category) {
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
            (sum, entry) =>
              sum + daysBetween(new Date(entry.borrowedOn), new Date(entry.returnedOn)),
            0
          );
          const avgDaysKept = totalRead ? Math.round(totalDaysKept / totalRead) : 0;

          return {
            totalRead,
            categoryCounts,
            topCategory: highestCount ? favoriteCategory : null,
            favoriteCategory,
            avgDaysKept,
            currentlyBorrowed: loans.length,
            activeHolds: holds.length,
            // Total borrowed = everything ever checked out (returned + still out).
            totalBorrowed: totalRead + loans.length,
          };
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        // Persist only durable member-specific data; never passwords/tokens
        // or transient loading/error flags.
        partialize: (state) => ({
          loans: state.loans,
          history: state.history,
          holds: state.holds,
          memberId: state.memberId,
          // Do not persist books (always re-fetched) or member profile
          // (re-fetched from API) or UI filters (reset on reload is fine).
        }),
        // On rehydrate, keep sample defaults if stored data is missing/corrupt
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn(
              "[LibraryStore] rehydrate failed, using defaults",
              (error && error.stack) || error
            );
          }
        },
        version: 1,
      }
    )
  )
);

export default useLibraryStore;

// Convenience selectors for components (stable references where possible)
export const selectBooks = (s) => s.books;
export const selectBooksStatus = (s) => s.booksStatus;
export const selectBooksError = (s) => s.booksError;
export const selectFilteredBooks = (s) => s.getFilteredBooks();
export const selectLoans = (s) => s.loans;
export const selectHistory = (s) => s.history;
export const selectHolds = (s) => s.holds;
export const selectMember = (s) => s.member;
export const selectMemberStatus = (s) => s.memberStatus;
export const selectLastMessage = (s) => s.lastMessage;
export const selectActionLoading = (s) => s.actionLoading;
