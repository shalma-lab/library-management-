import { memberAccounts } from "../data/authData";
import { ApiError } from "./apiClient";
import { loginWithApi, logoutFromApi } from "./authApiService";

// authService is the single place that "talks to the account store".
// Today the store is local (data/authData.js) because the project has no
// backend; swapping in real API calls later only means changing this file.
//
// Experiment 4: after the local credential check succeeds we also ask the
// auth API for a bearer token (see services/authApiService.js), so protected
// endpoints can be called with Authorization: Bearer <token>.

const SESSION_KEY = "athenaeum.session";
const SESSION_LENGTH_MS = 1000 * 60 * 60 * 8; // 8 hours
const SIMULATED_LATENCY_MS = 600;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

async function hashPassword(salt, password) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new AuthError(
      "Secure sign-in isn't available in this browser context. Use https or localhost.",
      "UNSUPPORTED"
    );
  }
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function findAccount(identifier) {
  const needle = identifier.trim().toLowerCase();
  return memberAccounts.find(
    ({ member }) => member.id.toLowerCase() === needle || member.email.toLowerCase() === needle
  );
}

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode, etc.): login still works for this tab.
  }
}

export function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}

// Check credentials and start a session. Resolves with the member, or
// rejects with an AuthError.
export async function login(identifier, password) {
  await wait(SIMULATED_LATENCY_MS);

  const account = findAccount(identifier);
  const candidateHash = account ? await hashPassword(account.salt, password) : null;

  if (!account || candidateHash !== account.passwordHash) {
    throw new AuthError("Incorrect Member ID/email or password.", "INVALID_CREDENTIALS");
  }

  // Experiment 4: trade the verified credentials for an API bearer token and
  // store it (tokenService). If the API is unreachable we still sign in
  // locally — exactly like before — but with no token, so protected calls
  // will answer 401 until the API is back.
  try {
    await loginWithApi(identifier, password);
  } catch (error) {
    if (!(error instanceof ApiError) || error.kind !== "network") throw error;
  }

  writeStoredSession({
    memberId: account.member.id,
    expiresAt: Date.now() + SESSION_LENGTH_MS,
  });
  return account.member;
}

// Look for a saved, unexpired session (used to restore on page refresh).
// Resolves with the member, or null.
export async function restoreSession() {
  const session = readStoredSession();
  if (!session || !session.memberId || session.expiresAt < Date.now()) {
    clearStoredSession();
    return null;
  }
  const account = findAccount(session.memberId);
  if (!account) {
    clearStoredSession();
    return null;
  }
  return account.member;
}

export async function logout() {
  // Experiment 4: tell the auth API (invalidates the token server-side) and
  // remove the stored token locally — even when that request fails, because
  // a logout must always leave the client clean.
  await logoutFromApi();
  clearStoredSession();
}
