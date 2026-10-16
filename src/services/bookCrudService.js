import { apiClient, toApiError, formatError, isAbort } from "./apiClient";

// Experiment 3 — the write side of the book catalog (REST + Axios).
// GET stays in bookService.js; these are POST / PUT / PATCH / DELETE.
//
// Every call requires the bearer token (the API answers 401 without it), and
// every failure is mapped through toApiError so the UI can show a friendly
// message in its error state.

const isBook = (b) => b && typeof b === "object" && b.id !== undefined && typeof b.title === "string";

async function request(method, url, body, config) {
  try {
    const { data } = await apiClient.request({ method, url, data: body, ...config });
    return data;
  } catch (error) {
    if (isAbort(error)) throw error;
    throw toApiError(error);
  }
}

// POST /api/books -> creates a book, resolves with the created copy (201).
export async function createBook(input, { signal } = {}) {
  const data = await request("POST", "/books", input, { signal });
  if (!isBook(data)) throw formatError();
  return data;
}

// PUT /api/books/:id -> full replacement (title + author are mandatory).
export async function updateBook(id, input, { signal } = {}) {
  const data = await request("PUT", `/books/${encodeURIComponent(id)}`, input, { signal });
  if (!isBook(data)) throw formatError();
  return data;
}

// PATCH /api/books/:id -> partial update: only the fields you send change.
export async function patchBook(id, patch, { signal } = {}) {
  const data = await request("PATCH", `/books/${encodeURIComponent(id)}`, patch, { signal });
  if (!isBook(data)) throw formatError();
  return data;
}

// DELETE /api/books/:id -> { ok: true, id }.
export async function deleteBook(id, { signal } = {}) {
  const data = await request("DELETE", `/books/${encodeURIComponent(id)}`, undefined, { signal });
  if (!data || data.ok !== true) throw formatError();
  return data;
}
