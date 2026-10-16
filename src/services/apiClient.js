import axios from "axios";
import { getToken, clearToken } from "./tokenService";

// One shared Axios instance. The base URL comes from the environment
// (REACT_APP_API_BASE_URL) and defaults to "/api", which the dev server
// proxies to the REST API (see "proxy" in package.json). Auth headers or
// interceptors added later belong here, so every service picks them up.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { Accept: "application/json" },
});

// Fired whenever the server rejects a token (401), so the UI can tell the
// member their session expired instead of just failing silently.
export const AUTH_EXPIRED_EVENT = "athenaeum:auth-expired";

// Experiment 4 — attach the bearer token to every protected request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Experiment 4 — handle invalid/expired tokens: drop the token immediately
// (so we never keep retrying with a dead credential) and announce it.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error && error.response ? error.response.status : null;
    if (status === 401) {
      clearToken();
      try {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      } catch {
        /* no window (tests/SSR): the 401 message still reaches the UI */
      }
    }
    return Promise.reject(error);
  }
);

// A request that was cancelled on purpose (new search, page change) is not
// an error the user should see.
export function isAbort(error) {
  return (
    axios.isCancel(error) ||
    (error && (error.name === "AbortError" || error.name === "CanceledError"))
  );
}

export class ApiError extends Error {
  constructor(message, { status = null, kind = "unknown" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind; // "network" | "http" | "format"
  }
}

const messageForStatus = (status, serverMessage) => {
  if (status === 404) return serverMessage || "We couldn't find what you were looking for.";
  if (status === 400) return serverMessage || "That request wasn't valid.";
  // 401/403: prefer the server's explanation (e.g. "Your session has
  // expired...") so the member knows whether to sign in again or ask for access.
  if (status === 401 || status === 403) return serverMessage || "You don't have permission to view this.";
  if (status >= 500) return "The library server ran into a problem. Please try again shortly.";
  return "Something went wrong while contacting the library server.";
};

const NETWORK_MESSAGE = "Can't reach the library server. Check your connection and try again.";

// Turn an Axios error into a safe, user-friendly ApiError. Only the server's
// short "error" string is ever surfaced -- never stack traces or raw bodies.
export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error && error.response) {
    const { status, data } = error.response;
    const serverMessage = data && typeof data.error === "string" && status < 500 ? data.error : "";
    return new ApiError(messageForStatus(status, serverMessage), { status, kind: "http" });
  }
  if (error && error.request) return new ApiError(NETWORK_MESSAGE, { kind: "network" });
  return new ApiError("Something went wrong. Please try again.", { kind: "unknown" });
}

// Same idea for the Fetch API (which only rejects on network failure).
export function networkError() {
  return new ApiError(NETWORK_MESSAGE, { kind: "network" });
}
export function httpError(status, serverMessage) {
  return new ApiError(messageForStatus(status, serverMessage), { status, kind: "http" });
}
export function formatError() {
  return new ApiError("The server sent data in an unexpected format.", { kind: "format" });
}

export const getErrorMessage = (error) =>
  error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
