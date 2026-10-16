import { apiClient, toApiError, formatError, isAbort } from "./apiClient";

// Experiment 3 — borrowing records over REST (create / update / delete).
// Combined with Experiment 4 these endpoints are token-protected, so the API
// answers 401 when the member is signed out or the token expired.
//
// Record shape: { id, memberId, bookId, borrowedOn, dueDate?, returnedOn?,
//                 renewals, status: "loan" | "returned" }

const isRecord = (r) => r && typeof r === "object" && r.id !== undefined && typeof r.bookId === "number";

async function request(method, url, body, config) {
  try {
    const { data } = await apiClient.request({ method, url, data: body, ...config });
    return data;
  } catch (error) {
    if (isAbort(error)) throw error;
    throw toApiError(error);
  }
}

// GET /api/borrowings?status=loan|returned -> every borrowing record.
export async function listBorrowings({ status, signal, params } = {}) {
  const data = await request("GET", "/borrowings", undefined, {
    signal,
    params: params || (status ? { status } : undefined),
  });
  if (!Array.isArray(data)) throw formatError();
  return data.filter(isRecord);
}

// GET /api/borrowings/:id -> one record.
export async function getBorrowing(id, { signal } = {}) {
  const data = await request("GET", `/borrowings/${encodeURIComponent(id)}`, undefined, { signal });
  if (!isRecord(data)) throw formatError();
  return data;
}

// POST /api/borrowings -> starts a loan: { bookId, memberId?, borrowedOn?, dueDate?, renewals? }.
export async function createBorrowing(payload, { signal } = {}) {
  const data = await request("POST", "/borrowings", payload, { signal });
  if (!isRecord(data)) throw formatError();
  return data;
}

// PUT /api/borrowings/:id -> full replacement (bookId required).
export async function updateBorrowing(id, payload, { signal } = {}) {
  const data = await request("PUT", `/borrowings/${encodeURIComponent(id)}`, payload, { signal });
  if (!isRecord(data)) throw formatError();
  return data;
}

// PATCH /api/borrowings/:id -> partial update (typical: renew or return a loan).
export async function patchBorrowing(id, patch, { signal } = {}) {
  const data = await request("PATCH", `/borrowings/${encodeURIComponent(id)}`, patch, { signal });
  if (!isRecord(data)) throw formatError();
  return data;
}

// DELETE /api/borrowings/:id -> { ok: true, id }.
export async function deleteBorrowing(id, { signal } = {}) {
  const data = await request("DELETE", `/borrowings/${encodeURIComponent(id)}`, undefined, { signal });
  if (!data || data.ok !== true) throw formatError();
  return data;
}
