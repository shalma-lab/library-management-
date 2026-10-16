import { apiClient, toApiError, formatError, isAbort } from "./apiClient";
import { saveToken, clearToken, getTokenExpiresAt } from "./tokenService";

// Experiment 4 — the authentication API.
//
// authService still owns the local credential check + session (so nothing in
// the existing app changes); this file is the half that talks to
// POST /api/auth/login, POST /api/auth/logout and GET /api/auth/me and keeps
// the bearer token in sync.

const isMember = (m) => m && typeof m === "object" && typeof m.name === "string";

// POST /api/auth/login -> { token, tokenType, expiresIn, expiresAt, member }.
// Stores the token and resolves with the member the API returns.
export async function loginWithApi(identifier, password) {
  try {
    const { data } = await apiClient.post("/auth/login", { identifier, password });
    if (!data || typeof data.token !== "string" || !data.token) throw formatError();
    const expiresAt =
      typeof data.expiresAt === "number" ? data.expiresAt : Date.now() + (Number(data.expiresIn) || 0);
    saveToken(data.token, expiresAt);
    return data.member;
  } catch (error) {
    if (isAbort(error)) throw error;
    throw toApiError(error);
  }
}

// POST /api/auth/logout -> invalidates the token on the server, then removes
// it locally no matter what happened (an already-dead token must still be
// cleared, which is exactly what "handle invalid tokens" means here).
export async function logoutFromApi() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // Network down or 401 (token already invalid/expired): nothing left to do.
  } finally {
    clearToken();
  }
}

// GET /api/auth/me -> the member behind the current token, or null when the
// token is missing/expired. Never throws: this is a status probe.
export async function fetchAuthenticatedMember({ signal } = {}) {
  try {
    const { data } = await apiClient.get("/auth/me", { signal });
    return isMember(data) ? data : null;
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

// Expiry of the stored token (ms), or null when there is none.
export function tokenExpiry() {
  return getTokenExpiresAt();
}
