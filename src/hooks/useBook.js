import { useState, useEffect, useCallback } from "react";
import { getBook, getRelatedBooks } from "../services/bookService";
import { getErrorMessage, isAbort } from "../services/apiClient";

// useBook(id): fetches one book from the API whenever the id changes.
// status: "loading" | "success" | "notfound" | "error". The previous book is
// cleared the moment the id changes, and a response for an old id is
// ignored (the request is aborted), so stale details never show.
export function useBook(id) {
  const [state, setState] = useState({ status: "loading", book: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", book: null, error: "" });

    getBook(id, { signal: controller.signal })
      .then((book) => setState({ status: "success", book, error: "" }))
      .catch((err) => {
        if (isAbort(err)) return;
        if (err.status === 404 || err.status === 400) {
          setState({ status: "notfound", book: null, error: getErrorMessage(err) });
        } else {
          setState({ status: "error", book: null, error: getErrorMessage(err) });
        }
      });

    return () => controller.abort();
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

// useRelatedBooks(id): books related to this one. A failure here only hides
// the "related" row (with a message); it never breaks the details page.
export function useRelatedBooks(id) {
  const [state, setState] = useState({ status: "loading", books: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", books: [], error: "" });

    getRelatedBooks(id, { signal: controller.signal })
      .then((books) => setState({ status: "success", books, error: "" }))
      .catch((err) => {
        if (isAbort(err)) return;
        setState({ status: "error", books: [], error: getErrorMessage(err) });
      });

    return () => controller.abort();
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
