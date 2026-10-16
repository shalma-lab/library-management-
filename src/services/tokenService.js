// Experiment 4 — where the bearer token issued by POST /api/auth/login lives.
//
// The token is separate from the local session in authService (that keeps
// working exactly as before, so refresh/restore is unchanged). Everything
// that talks to a protected endpoint reads the token through getToken().

const TOKEN_KEY = "athenaeum.api_token";

function readRecord() {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Persist a token plus its expiry (both come back from the auth API).
export function saveToken(token, expiresAt) {
  if (typeof token !== "string" || !token) return false;
  try {
    window.localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ token, expiresAt: typeof expiresAt === "number" ? expiresAt : null })
    );
    return true;
  } catch {
    // Storage unavailable (private mode): the token just won't survive a reload.
    return false;
  }
}

// Returns the token only while it is present and not expired locally, so an
// expired token is never sent to the server (the server double-checks anyway).
export function getToken() {
  const record = readRecord();
  if (!record || typeof record.token !== "string" || !record.token) return null;
  if (typeof record.expiresAt === "number" && record.expiresAt <= Date.now()) {
    clearToken();
    return null;
  }
  return record.token;
}

// Remove the token — used on logout and whenever the server answers 401.
export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}

// Expiry timestamp in ms, or null when the token is missing/already expired.
export function getTokenExpiresAt() {
  const record = readRecord();
  if (!record || typeof record.token !== "string") return null;
  if (typeof record.expiresAt !== "number") return null;
  return record.expiresAt <= Date.now() ? null : record.expiresAt;
}

export function hasActiveToken() {
  return getToken() !== null;
}
