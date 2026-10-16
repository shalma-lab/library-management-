# Athenaeum — Library Management App

A library management web app: browse and search books, view details, borrow /
return / renew, place holds, see reading history and recommendations, and sign
in as a member. Built with **React 18**, **React Router 6**, **Zustand**,
**Axios**, and a small zero-dependency **Node REST API** that serves the sample data.

## Features

- Search books by title / ISBN and by author; filter by category and availability
- Book details page (`/books/:id`) with related books
- Borrow, return, renew, and place holds; reading history and stats
- Personalised recommendations from the API
- Member login with bearer tokens; protected pages and a book management page
- Loading, empty and error states with retry on every API-driven screen

## Getting started

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run start:api   # terminal 1 - REST API on http://localhost:5001
npm start           # terminal 2 - React app on http://localhost:3000
```

Other scripts:

```bash
npm test -- --watchAll=false   # run the test suite once
npm run build                  # production build into build/
```

**Demo sign-in:** Member ID `M-1001` (or `priya.natarajan@athenaeum.example`),
password `Library@2024`. This is sample data for local development only.

### Configuration

Copy `.env.example` to `.env` to override defaults. Without it the app calls
`/api`, which the dev server proxies to `http://localhost:5001`.

| Variable | Used by | Purpose |
|---|---|---|
| `REACT_APP_API_BASE_URL` | React app | API base URL (default `/api`) |
| `PORT` | API server | Port (default `5001`) |
| `API_DELAY_MS` | API server | Simulated latency to see loading states |
| `TOKEN_TTL_MS` | API server | Token lifetime (default 8 hours) |

## Project structure

```
server/server.cjs      REST API (no dependencies; serves src/data/sampleData.js)
public/                static HTML shell
src/
  components/          BookList, BookCard, SearchBar, FilterPanel, Status, RequireAuth, ...
  context/             LibraryContext (backed by the Zustand store), AuthContext
  hooks/               useBooks, useBook, useBorrowing, useMember, useRecommendations
  pages/               Home, Books, BookDetail, BorrowedBooks, ReadingHistory,
                       Recommendations, Profile, Manage, Login
  services/            apiClient (Axios), book / member / borrowing / auth / token services
  store/               libraryStore.js (Zustand)
  data/                sample books, member and accounts
  __tests__/           component and store tests
  App.jsx, index.js, index.css
```

## Development notes

The sections below document how each part was built.

## Custom hooks

### `useBooks()`
Owns the book catalog and every search/filter control:
- State: `books`, `titleQuery`, `authorQuery`, `categoryFilter`, `availabilityOnly`
- `useEffect` loads the starting catalog once on mount
- `useMemo` builds `categories`, `authors`, and the final `filteredBooks` list
- `useCallback` provides `findBookById` and `adjustAvailability` (used by `useBorrowing`)

### `useBorrowing({ getBook, adjustAvailability })`
Owns everything about the member's borrowing activity:
- State: `loans`, `history`, `holds`
- `useEffect` loads saved borrowing data from `localStorage` on mount, and
  saves it back to `localStorage` every time it changes
- `useMemo` builds `overdueLoans`, `dueSoonLoans`, and `readingStats`
- `useCallback` provides `borrowBook`, `returnBook`, `renewBook`, `placeHold`,
  and `clearBorrowing`

## Context API

`LibraryContext` (in `context/LibraryContext.jsx`) calls both hooks and
shares the combined result through `useLibrary()`. Every page —
`BookList`/`Books`, `BookDetail`, `BorrowedBooks`, `Profile`, and
`ReadingHistory` — reads book and member data directly with `useLibrary()`
instead of receiving it as props from `App.jsx`. `App.jsx` itself holds no
shared state anymore; it just wraps the routes in `<LibraryProvider>`.

## Conditional rendering messages

- **"No books found"** — Books page, when filters/search match nothing
- **"Book currently unavailable"** — Book Detail page, when there are no
  copies left to borrow
- **"No borrowed books"** — Borrowed Books page, when nothing is checked out
- **"Book renewal is not available"** — Borrowed Books page, once the
  renewal limit has been reached for a book
- **"No reading history available"** — Reading History page, before
  anything has been returned

## Authentication (Experiment 4)

- `context/AuthContext.jsx` -> `AuthProvider` + `useAuth()` (`member`,
  `isAuthenticated`, `isInitializing`, `login`, `logout`). Restores the
  session on refresh; `isInitializing` is true until that check finishes.
- `services/authService.js` -> login / restoreSession / logout. Early on the
  project had no backend, so accounts live in `data/authData.js` (salted SHA-256
  password hash, never plain text). The REST API (`server/server.cjs`) now
  reads the same file and issues bearer tokens via `/api/auth/login`.
- `pages/Login.jsx` (`/login`) -> controlled form with validation, loading
  state, double-submit protection and an invalid-credentials message.
- `utils/validators.js` -> email, Member ID (`M-1001` style) and password
  (8+ chars, letter + number) rules.
- Header shows Login / Log out. `AuthProvider` is mounted in `index.js`
  inside `BrowserRouter`, alongside the existing `LibraryProvider`.
- Demo sign-in: Member ID `M-1001` (or `priya.natarajan@athenaeum.example`),
  password `Library@2024`.

## REST API & async data (Experiment 1)

The project had no backend, so `server/server.cjs` (zero dependencies) was
added. It serves the **existing** `src/data/sampleData.js` over REST; swap it
for a real backend any time -- the React app only depends on this contract.

| Purpose | Endpoint |
|---|---|
| Books (all; optional `search`, `category`, `available`) | `GET /api/books` |
| Book details | `GET /api/books/:id` (400 bad id, 404 not found) |
| Related books | `GET /api/books/:id/related` |
| Member | `GET /api/members/:id` |
| Recommendations | `GET /api/members/:id/recommendations?exclude=1,2&categories=A,B` |

Frontend layout:
- `services/apiClient.js` -> shared Axios instance (`REACT_APP_API_BASE_URL`,
  default `/api`), safe error messages, abort helpers
- `services/bookService.js`, `memberService.js` -> Axios;
  `recommendationService.js` -> Fetch (checks `response.ok`)
- `hooks/useBooks.js` (catalog + `booksStatus`), `useBook.js` (one book + related),
  `useMember.js`, `useRecommendations.js` -> loading / success / error state,
  `AbortController` cancellation, retry
- `components/Status.jsx` -> `LoadingState` / `ErrorState` (with retry)
- `components/RecommendationsSection.jsx` -> API recommendations; if the API fails
  it shows the error plus the old in-browser suggestions, labelled as local

Search and category filters run in memory on the loaded catalog (no request per
keystroke). The title box also matches ISBN when a book has one. Borrowing is
unchanged and still lives in the browser (`localStorage`), so live copy counts
override the count returned by the API.

Run it with two terminals: `npm run start:api` (port 5001) and `npm start`.
Set `API_DELAY_MS=1500` before `npm run start:api` to see loading states.

## Experiment 6 – Library State Management (Zustand)

### Chosen library
**Zustand** (v5) with its official `persist` middleware.

**Reason for selection**
- The project previously used React Context + custom hooks (`useBooks`, `useBorrowing`, `useMember`) and had no Redux Toolkit or Zustand dependency.
- Zustand is a minimal, modern global store that fits a medium-sized SPA without Provider boilerplate.
- Its `persist` middleware maps cleanly onto the existing `localStorage` pattern used for loans / history / holds.
- Redux Toolkit was considered first (preferred when a structured multi-slice store is needed), but Zustand was chosen for lighter integration and zero peer-dependency friction in this environment.

### Global store (`src/store/libraryStore.js`)
Centralised state categories:

| Category | State |
|---|---|
| **Books** | `books`, `booksStatus`, `booksError`, search/filter UI state (`titleQuery`, `authorQuery`, `categoryFilter`, `availabilityOnly`) |
| **Borrowed** | `loans`, `holds`, `actionLoading`, `lastMessage` |
| **Reading history** | `history` |
| **Member** | `member`, `memberStatus`, `memberError`, `memberId` |

### Actions
- `fetchBooks` / `fetchMember` – async, AbortController-aware, update status/error.
- `borrowBook`, `returnBook`, `renewBook`, `placeHold` – pure client-side (matches existing backend contract which only exposes GET endpoints). Validate availability / eligibility, update loans/history/holds and book `availableCopies`, set user-facing `lastMessage`.
- `clearBorrowing` / `clearMemberState` – used on logout and demo reset.
- Filter setters + `resetFilters`, `findBookById`, `adjustAvailability`.

### Middleware / monitoring
A lightweight development-only logger wraps the store. It records timestamps and non-sensitive state changes (counts of loans/history/holds, status flags, lastMessage) without logging member PII or full book arrays. Production builds are silent.

### Browser storage synchronisation
Zustand `persist` middleware (key `athenaeum_library_store_v1`) writes only durable, non-sensitive fields:
- `loans`, `history`, `holds`, `memberId`
Books and the live member profile are always re-fetched from the API on load so server data wins over any stale cache. Transient flags (`booksStatus`, `actionLoading`, etc.) are never persisted.

### Integration
`LibraryProvider` (still the single entry point used by every page) now reads from and writes to the Zustand store. The public shape of `useLibrary()` is unchanged, so existing pages and components required no structural rewrites.

### New / modified files
- **New**: `src/store/libraryStore.js`
- **Modified**: `src/context/LibraryContext.jsx` (backed by the store), `src/context/AuthContext.jsx` (clears member-specific store state on logout), `package.json` (adds `zustand`)

Existing hooks (`useBooks`, `useBorrowing`, …) remain in the tree for reference but are no longer the source of truth; the store is.

### How to run
```bash
npm install
npm run start:api   # terminal 1
npm start           # terminal 2
```
