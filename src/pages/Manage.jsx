import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../context/LibraryContext";
import { useAuth } from "../context/AuthContext";
import { LoadingState, ErrorState } from "../components/Status";
import { getErrorMessage, isAbort } from "../services/apiClient";
import { hasActiveToken } from "../services/tokenService";
import { fetchAuthenticatedMember, tokenExpiry } from "../services/authApiService";
import { createBook, updateBook, patchBook, deleteBook } from "../services/bookCrudService";
import {
  listBorrowings,
  createBorrowing,
  updateBorrowing,
  patchBorrowing,
  deleteBorrowing,
} from "../services/borrowingApiService";
import { LOAN_DAYS } from "../data/sampleData";

// Manage is the hands-on screen for two experiments:
//
//   Experiment 3 — CRUD over REST with Axios: create / read / update (PUT and
//   PATCH) / delete books, plus create / update / delete borrowing records,
//   each with explicit loading and error states.
//
//   Experiment 4 — every mutation goes out with Authorization: Bearer <token>
//   (added by the apiClient interceptor), the session card proves it with
//   GET /api/auth/me, and a 401 (invalid or expired token) surfaces as an
//   error with the server's own message while the token is dropped.
//
// The page itself is wrapped in RequireAuth, so guests are sent to Login.

const EMPTY_BOOK_FORM = {
  title: "",
  author: "",
  category: "",
  year: "",
  rating: "",
  totalCopies: "",
  availableCopies: "",
  description: "",
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatDateTime = (ms) => {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const numberOrNull = (raw) => (String(raw).trim() === "" ? null : Number(raw));

// Form -> payload for POST / PUT.
function bookPayload(form) {
  const payload = { title: form.title.trim(), author: form.author.trim() };
  if (form.category.trim()) payload.category = form.category.trim();
  if (form.description.trim()) payload.description = form.description.trim();
  const year = numberOrNull(form.year);
  if (year !== null) payload.year = year;
  const rating = numberOrNull(form.rating);
  if (rating !== null) payload.rating = rating;
  const total = numberOrNull(form.totalCopies);
  if (total !== null) payload.totalCopies = total;
  const available = numberOrNull(form.availableCopies);
  if (available !== null) payload.availableCopies = available;
  return payload;
}

// Only the fields the member actually changed -> payload for PATCH.
function diffBookPayload(form, book) {
  const payload = {};
  if (form.title.trim() !== (book.title || "")) payload.title = form.title.trim();
  if (form.author.trim() !== (book.author || "")) payload.author = form.author.trim();
  if (form.category.trim() !== (book.category || "")) payload.category = form.category.trim();
  if (form.description.trim() !== (book.description || "")) payload.description = form.description.trim();
  const year = numberOrNull(form.year);
  if (year !== null && year !== book.year) payload.year = year;
  const rating = numberOrNull(form.rating);
  if (rating !== null && rating !== book.rating) payload.rating = rating;
  const total = numberOrNull(form.totalCopies);
  if (total !== null && total !== book.totalCopies) payload.totalCopies = total;
  const available = numberOrNull(form.availableCopies);
  if (available !== null && available !== book.availableCopies) payload.availableCopies = available;
  return payload;
}

function validateForm(form) {
  if (!form.title.trim()) return "Title is required.";
  if (!form.author.trim()) return "Author is required.";
  const year = numberOrNull(form.year);
  if (year !== null && (!Number.isInteger(year) || year < 0)) return "Year must be a whole number.";
  const rating = numberOrNull(form.rating);
  if (rating !== null && (rating < 0 || rating > 5)) return "Rating must be between 0 and 5.";
  const total = numberOrNull(form.totalCopies);
  if (total !== null && (!Number.isInteger(total) || total < 1)) return "Total copies must be 1 or more.";
  const available = numberOrNull(form.availableCopies);
  if (available !== null && (!Number.isInteger(available) || available < 0)) {
    return "Available copies must be 0 or more.";
  }
  return "";
}

function Manage() {
  const { books, booksStatus, booksError, reloadBooks, findBookById, categories } = useLibrary();
  const { member, isAuthenticated } = useAuth();

  // ---------- shared action state (loading / error / success feedback) ----------
  const [busyKey, setBusyKey] = useState("");
  const [actionError, setActionError] = useState("");
  const [flash, setFlash] = useState("");

  const runAction = useCallback(
    async (key, action) => {
      if (busyKey) return;
      setBusyKey(key);
      setActionError("");
      setFlash("");
      try {
        const message = await action();
        if (message) setFlash(message);
      } catch (error) {
        setActionError(getErrorMessage(error));
      } finally {
        setBusyKey("");
      }
    },
    [busyKey]
  );

  // ---------- Experiment 4: prove the token works (GET /api/auth/me) ----------
  const [apiMember, setApiMember] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setSessionStatus("loading");
    fetchAuthenticatedMember({ signal: controller.signal })
      .then((resolved) => {
        if (cancelled) return;
        setApiMember(resolved);
        setSessionStatus(resolved ? "ok" : "error");
      })
      .catch((error) => {
        if (cancelled || isAbort(error)) return;
        setApiMember(null);
        setSessionStatus("error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const tokenActive = hasActiveToken();
  const tokenExpires = tokenExpiry();

  // ---------- Experiment 3: book form ----------
  const [form, setForm] = useState(EMPTY_BOOK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_BOOK_FORM);
    setFormError("");
    setFlash("");
    setActionError("");
  };

  const startEdit = (book) => {
    setEditingId(book.id);
    setForm({
      title: book.title || "",
      author: book.author || "",
      category: book.category || "",
      year: book.year !== undefined && book.year !== null ? String(book.year) : "",
      rating: book.rating !== undefined && book.rating !== null ? String(book.rating) : "",
      totalCopies: book.totalCopies !== undefined && book.totalCopies !== null ? String(book.totalCopies) : "",
      availableCopies:
        book.availableCopies !== undefined && book.availableCopies !== null
          ? String(book.availableCopies)
          : "",
      description: book.description || "",
    });
    setFormError("");
    setFlash("");
    setActionError("");
  };

  const editingBook = editingId !== null ? findBookById(editingId) : null;

  const handleCreate = () => {
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    runAction("create-book", async () => {
      const created = await createBook(bookPayload(form));
      await reloadBooks();
      startCreate();
      return `Created “${created.title}” (id ${created.id}).`;
    });
  };

  const handleSaveFull = () => {
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!editingBook) return;
    runAction(`put-book-${editingBook.id}`, async () => {
      const updated = await updateBook(editingBook.id, bookPayload(form));
      await reloadBooks();
      setFormError("");
      return `Saved full record for “${updated.title}” with PUT.`;
    });
  };

  const handleSavePartial = () => {
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!editingBook) return;
    const patch = diffBookPayload(form, editingBook);
    if (Object.keys(patch).length === 0) {
      setActionError("");
      setFlash("Nothing changed — edit a field first, then apply the PATCH.");
      return;
    }
    runAction(`patch-book-${editingBook.id}`, async () => {
      const updated = await patchBook(editingBook.id, patch);
      await reloadBooks();
      setFormError("");
      const fields = Object.keys(patch).join(", ");
      return `Patched ${fields} on “${updated.title}”.`;
    });
  };

  const handleDeleteBook = (book) => {
    if (!window.confirm(`Delete “${book.title}” from the catalog?`)) return;
    runAction(`delete-book-${book.id}`, async () => {
      await deleteBook(book.id);
      if (editingId === book.id) startCreate();
      await reloadBooks();
      return `Deleted “${book.title}” (id ${book.id}).`;
    });
  };

  // ---------- Experiment 3: borrowing records ----------
  const [records, setRecords] = useState([]);
  const [recordsStatus, setRecordsStatus] = useState("loading");
  const [recordsError, setRecordsError] = useState("");
  const [newLoanBookId, setNewLoanBookId] = useState("");
  const [recordError, setRecordError] = useState("");

  const loadRecords = useCallback(async (signal) => {
    setRecordsStatus("loading");
    setRecordsError("");
    try {
      const list = await listBorrowings({ signal });
      setRecords(list);
      setRecordsStatus("success");
    } catch (error) {
      if (isAbort(error)) return;
      setRecords([]);
      setRecordsError(getErrorMessage(error));
      setRecordsStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords]);

  const loanCount = useMemo(() => records.filter((r) => r.status === "loan").length, [records]);

  const handleCreateRecord = () => {
    const bookId = Number(newLoanBookId);
    if (!bookId) {
      setRecordError("Choose a book to start a loan.");
      return;
    }
    setRecordError("");
    runAction("create-record", async () => {
      const record = await createBorrowing({ bookId });
      setNewLoanBookId("");
      await loadRecords();
      return `Started loan #${record.id} (due ${formatDate(record.dueDate)}).`;
    });
  };

  const handleRenew = (record) => {
    const currentDue = new Date(record.dueDate || Date.now());
    const base = currentDue < new Date() ? new Date() : currentDue;
    base.setDate(base.getDate() + (Number(LOAN_DAYS) || 14));
    runAction(`renew-${record.id}`, async () => {
      const updated = await patchBorrowing(record.id, {
        renewals: (record.renewals || 0) + 1,
        dueDate: base.toISOString(),
      });
      await loadRecords();
      return `Renewed loan #${updated.id} — now due ${formatDate(updated.dueDate)}.`;
    });
  };

  const handleReturn = (record) => {
    runAction(`return-${record.id}`, async () => {
      const updated = await updateBorrowing(record.id, {
        bookId: record.bookId,
        memberId: record.memberId,
        borrowedOn: record.borrowedOn,
        dueDate: record.dueDate,
        renewals: record.renewals || 0,
        status: "returned",
        returnedOn: new Date().toISOString(),
      });
      await loadRecords();
      return `Returned loan #${updated.id} with PUT.`;
    });
  };

  const handleDeleteRecord = (record) => {
    if (!window.confirm(`Delete borrowing record #${record.id}?`)) return;
    runAction(`delete-record-${record.id}`, async () => {
      await deleteBorrowing(record.id);
      await loadRecords();
      return `Deleted borrowing record #${record.id}.`;
    });
  };

  // Guests never reach here (RequireAuth redirects), but keep the guard so
  // the page is safe if it is ever rendered without the wrapper.
  if (!isAuthenticated || !member) {
    return (
      <div className="container">
        <h1 className="page-title">Library Management</h1>
        <div className="empty-state">
          <p>You need to sign in to manage the catalog.</p>
          <Link to="/login">Go to login →</Link>
        </div>
      </div>
    );
  }

  const bookListLoading = booksStatus === "loading";
  const bookListError = booksStatus === "error";

  return (
    <div className="container">
      <h1 className="page-title">Library Management</h1>
      <p className="page-subtitle">
        Experiment 3 (CRUD over REST with Axios) · Experiment 4 (token-protected API)
      </p>

      {/* ---------- Session / token card ---------- */}
      <section className="manage-session" aria-label="Session">
        <div>
          <span className="manage-label">Signed in</span>
          <strong>
            {member.name} ({member.id})
          </strong>
        </div>
        <div>
          <span className="manage-label">Bearer token</span>
          <strong data-testid="token-status">
            {tokenActive ? `active until ${formatDateTime(tokenExpires)}` : "none stored"}
          </strong>
        </div>
        <div>
          <span className="manage-label">GET /api/auth/me</span>
          <strong>
            {sessionStatus === "loading"
              ? "checking…"
              : sessionStatus === "ok"
                ? `verified for ${apiMember.name}`
                : "could not verify session"}
          </strong>
        </div>
      </section>

      {/* ---------- Feedback: success flash + action errors ---------- */}
      {flash && (
        <div className="status-msg success manage-flash" role="status">
          {flash}
        </div>
      )}
      {actionError && (
        <div className="form-alert manage-flash" role="alert">
          {actionError}
        </div>
      )}

      {/* =================== Books: create / read / update / delete =================== */}
      <section className="manage-section" aria-labelledby="manage-books-title">
        <div className="manage-section-head">
          <h2 id="manage-books-title">Books</h2>
          <button type="button" className="btn-small" onClick={startCreate} disabled={Boolean(busyKey)}>
            New book
          </button>
        </div>

        {/* CRUD form: POST when no book is selected, PUT/PATCH when one is */}
        <div className="manage-form">
          <div className="manage-form-grid">
            <div className="form-field">
              <label htmlFor="manage-title">Title *</label>
              <input
                id="manage-title"
                name="title"
                type="text"
                value={form.title}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="manage-author">Author *</label>
              <input
                id="manage-author"
                name="author"
                type="text"
                value={form.author}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="manage-category">Category</label>
              <input
                id="manage-category"
                name="category"
                type="text"
                list="manage-categories"
                value={form.category}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
              <datalist id="manage-categories">
                {categories.map((category) => (
                  <option value={category} key={category} />
                ))}
              </datalist>
            </div>
            <div className="form-field">
              <label htmlFor="manage-year">Year</label>
              <input
                id="manage-year"
                name="year"
                type="number"
                value={form.year}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="manage-rating">Rating (0–5)</label>
              <input
                id="manage-rating"
                name="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="manage-total">Total copies</label>
              <input
                id="manage-total"
                name="totalCopies"
                type="number"
                min="1"
                value={form.totalCopies}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="manage-available">Available copies</label>
              <input
                id="manage-available"
                name="availableCopies"
                type="number"
                min="0"
                value={form.availableCopies}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
            <div className="form-field manage-span">
              <label htmlFor="manage-description">Description</label>
              <input
                id="manage-description"
                name="description"
                type="text"
                value={form.description}
                onChange={updateField}
                disabled={Boolean(busyKey)}
              />
            </div>
          </div>

          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}

          <div className="manage-form-actions">
            {editingId === null ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={Boolean(busyKey)}
              >
                {busyKey === "create-book" ? "Creating…" : "Create book (POST)"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveFull}
                  disabled={Boolean(busyKey)}
                >
                  {busyKey === `put-book-${editingId}` ? "Saving…" : "Save full record (PUT)"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSavePartial}
                  disabled={Boolean(busyKey)}
                >
                  {busyKey === `patch-book-${editingId}` ? "Applying…" : "Apply changes (PATCH)"}
                </button>
                <button type="button" className="btn-outline" onClick={startCreate} disabled={Boolean(busyKey)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Catalog list: the same loading / error / success states as Books */}
        {bookListLoading ? (
          <LoadingState message="Loading the catalog…" />
        ) : bookListError ? (
          <ErrorState message={booksError} onRetry={reloadBooks} />
        ) : books.length === 0 ? (
          <div className="empty-state">
            <p>No books in the catalog yet — add the first one above.</p>
          </div>
        ) : (
          <div className="loan-list">
            {books.map((book) => (
              <div className="loan-row" key={book.id}>
                <div className="info">
                  <h3>{book.title}</h3>
                  <p style={{ margin: "2px 0", color: "#666" }}>
                    {book.author} · {book.category}
                  </p>
                  <div className="dates">
                    <span>#{book.id}</span>
                    <span>{book.availableCopies}/{book.totalCopies} available</span>
                    <span>Rating {book.rating}</span>
                  </div>
                </div>
                <div className="loan-actions">
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => startEdit(book)}
                    disabled={Boolean(busyKey)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-return"
                    onClick={() => handleDeleteBook(book)}
                    disabled={Boolean(busyKey)}
                  >
                    {busyKey === `delete-book-${book.id}` ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ Borrowing records: create / update / delete (protected) ============ */}
      <section className="manage-section" aria-labelledby="manage-records-title">
        <div className="manage-section-head">
          <h2 id="manage-records-title">Borrowing records</h2>
          <span className="manage-count">
            {recordsStatus === "success" ? `${records.length} total · ${loanCount} active` : ""}
          </span>
        </div>

        <div className="manage-form">
          <div className="manage-inline-form">
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="manage-new-loan">Start a loan for</label>
              <select
                id="manage-new-loan"
                value={newLoanBookId}
                onChange={(event) => {
                  setNewLoanBookId(event.target.value);
                  setRecordError("");
                }}
                disabled={Boolean(busyKey)}
              >
                <option value="">Choose a book…</option>
                {books.map((book) => (
                  <option value={book.id} key={book.id}>
                    {book.title} ({book.availableCopies} left)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateRecord}
              disabled={Boolean(busyKey)}
            >
              {busyKey === "create-record" ? "Creating…" : "Create loan (POST)"}
            </button>
          </div>
          {recordError && (
            <p className="field-error" role="alert">
              {recordError}
            </p>
          )}
        </div>

        {recordsStatus === "loading" ? (
          <LoadingState message="Loading borrowing records…" />
        ) : recordsStatus === "error" ? (
          <ErrorState message={recordsError} onRetry={() => loadRecords()} />
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p>No borrowing records yet.</p>
          </div>
        ) : (
          <div className="loan-list">
            {records.map((record) => {
              const book = findBookById(record.bookId);
              const isActive = record.status === "loan";
              return (
                <div className="loan-row" key={record.id}>
                  <div className="info">
                    <h3>
                      {book ? book.title : `Book #${record.bookId}`}{" "}
                      <span className={`tag ${isActive ? "" : "tag-muted"}`}>
                        {isActive ? "On loan" : "Returned"}
                      </span>
                    </h3>
                    <p style={{ margin: "2px 0", color: "#666" }}>
                      Record #{record.id} · member {record.memberId}
                    </p>
                    <div className="dates">
                      <span>Borrowed {formatDate(record.borrowedOn)}</span>
                      <span>
                        {isActive ? `Due ${formatDate(record.dueDate)}` : `Returned ${formatDate(record.returnedOn)}`}
                      </span>
                      <span>Renewals: {record.renewals || 0}</span>
                    </div>
                  </div>
                  <div className="loan-actions">
                    {isActive && (
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => handleRenew(record)}
                        disabled={Boolean(busyKey)}
                      >
                        {busyKey === `renew-${record.id}` ? "Renewing…" : "Renew (PATCH)"}
                      </button>
                    )}
                    {isActive && (
                      <button
                        type="button"
                        className="btn-small btn-return"
                        onClick={() => handleReturn(record)}
                        disabled={Boolean(busyKey)}
                      >
                        {busyKey === `return-${record.id}` ? "Returning…" : "Return (PUT)"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => handleDeleteRecord(record)}
                      disabled={Boolean(busyKey)}
                    >
                      {busyKey === `delete-record-${record.id}` ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Manage;
