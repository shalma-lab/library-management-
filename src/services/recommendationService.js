import { API_BASE_URL, networkError, httpError, formatError, isAbort } from "./apiClient";

// This service deliberately uses the Fetch API (the rest of the services use
// Axios) to show both. Fetch does not reject on HTTP errors, so response.ok
// is checked explicitly.
//
// GET /api/members/:id/recommendations?exclude=1,2&categories=A,B
export async function getRecommendations(memberId, { exclude = [], categories = [], signal } = {}) {
  const params = new URLSearchParams();
  if (exclude.length) params.set("exclude", exclude.join(","));
  if (categories.length) params.set("categories", categories.join(","));
  const query = params.toString();
  const url = `${API_BASE_URL}/members/${encodeURIComponent(memberId)}/recommendations${query ? `?${query}` : ""}`;

  let response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw networkError();
  }

  if (!response.ok) {
    let serverMessage = "";
    try {
      const body = await response.json();
      if (body && typeof body.error === "string" && response.status < 500) serverMessage = body.error;
    } catch {
      /* body wasn't JSON; use the generic message */
    }
    throw httpError(response.status, serverMessage);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw formatError();
  }
  if (!Array.isArray(data)) throw formatError();

  // Drop malformed entries and duplicates.
  const seen = new Set();
  return data.filter((b) => {
    if (!b || b.id === undefined || typeof b.title !== "string" || seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}
