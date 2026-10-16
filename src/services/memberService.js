import { apiClient, toApiError, formatError, isAbort } from "./apiClient";

// GET /api/members/:id -> member profile.
export async function getMember(memberId, { signal } = {}) {
  try {
    const { data } = await apiClient.get(`/members/${encodeURIComponent(memberId)}`, { signal });
    if (!data || typeof data !== "object" || typeof data.name !== "string") throw formatError();
    return { ...data, favoriteCategories: Array.isArray(data.favoriteCategories) ? data.favoriteCategories : [] };
  } catch (error) {
    if (isAbort(error)) throw error;
    throw toApiError(error);
  }
}
