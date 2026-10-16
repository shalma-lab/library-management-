import { useState, useEffect, useCallback } from "react";
import { getRecommendations } from "../services/recommendationService";
import { getErrorMessage, isAbort } from "../services/apiClient";

// useRecommendations: loads recommendations from the REST API for a member.
// `exclude` (book ids already borrowed/read) and `categories` (extra liked
// categories) are sent as query parameters. The request only re-runs when
// those values actually change (compared by value, not array identity).
export default function useRecommendations(memberId, exclude, categories) {
  const [state, setState] = useState({ status: "loading", books: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  const excludeKey = [...exclude].sort((a, b) => a - b).join(",");
  const categoriesKey = [...categories].sort().join(",");

  useEffect(() => {
    if (!memberId) return undefined;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: "loading", error: "" }));

    getRecommendations(memberId, {
      exclude: excludeKey ? excludeKey.split(",").map(Number) : [],
      categories: categoriesKey ? categoriesKey.split(",") : [],
      signal: controller.signal,
    })
      .then((books) => setState({ status: "success", books, error: "" }))
      .catch((err) => {
        if (isAbort(err)) return;
        setState({ status: "error", books: [], error: getErrorMessage(err) });
      });

    return () => controller.abort();
  }, [memberId, excludeKey, categoriesKey, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
