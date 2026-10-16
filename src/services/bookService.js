import { apiClient, toApiError, formatError, isAbort } from "./apiClient";

const isBook = (b) => b && typeof b === "object" && b.id !== undefined && typeof b.title === "string";

async function get(url, config) {
  try {
    const { data } = await apiClient.get(url, config);
    return data;
  } catch (error) {
    if (isAbort(error)) throw error;
    throw toApiError(error);
  }
}

// GET /api/books -> every book. The UI filters this list in memory, so
// typing in the search box never triggers another request.
export async function getBooks({ signal, params } = {}) {
  const data = await get("/books", { signal, params });
  if (!Array.isArray(data)) throw formatError();
  return data.filter(isBook);
}

// GET /api/books/:id -> one book (404 if it doesn't exist).
export async function getBook(id, { signal } = {}) {
  const data = await get(`/books/${encodeURIComponent(id)}`, { signal });
  if (!isBook(data)) throw formatError();
  return data;
}

// GET /api/books/:id/related -> books in the same category or by the same author.
export async function getRelatedBooks(id, { signal } = {}) {
  const data = await get(`/books/${encodeURIComponent(id)}/related`, { signal });
  if (!Array.isArray(data)) throw formatError();
  return data.filter(isBook);
}
