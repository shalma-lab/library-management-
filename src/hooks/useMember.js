import { useState, useEffect, useCallback } from "react";
import { getMember } from "../services/memberService";
import { getErrorMessage, isAbort } from "../services/apiClient";

// useMember: loads the member profile from the REST API.
export default function useMember(memberId) {
  const [state, setState] = useState({ status: "loading", member: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", member: null, error: "" });

    getMember(memberId, { signal: controller.signal })
      .then((member) => setState({ status: "success", member, error: "" }))
      .catch((err) => {
        if (isAbort(err)) return;
        setState({ status: "error", member: null, error: getErrorMessage(err) });
      });

    return () => controller.abort();
  }, [memberId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
