import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authService from "../services/authService";
import { AUTH_EXPIRED_EVENT } from "../services/apiClient";
import useLibraryStore from "../store/libraryStore";

// AuthContext holds who is signed in. It sits next to LibraryContext and
// does not touch it, so every existing page keeps working as before.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [member, setMember] = useState(null);
  // True until the first session check finishes. Anything that gates content
  // on authentication should wait for this to be false, so protected content
  // never flashes (or redirects wrongly) before we know who the member is.
  const [isInitializing, setIsInitializing] = useState(true);
  // One-off explanation shown by the Login page (e.g. expired token).
  const [notice, setNotice] = useState("");
  // Read by the 401 handler below; kept in a ref so the listener installed
  // once can still see the latest member without re-subscribing.
  const memberRef = useRef(member);
  useEffect(() => {
    memberRef.current = member;
  }, [member]);

  // Restore the session on page refresh.
  useEffect(() => {
    let cancelled = false;
    authService
      .restoreSession()
      .then((restored) => {
        if (!cancelled) setMember(restored);
      })
      .catch(() => {
        if (!cancelled) setMember(null);
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep several open tabs in sync: signing out in one signs out in all.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === "athenaeum.session" && !event.newValue) setMember(null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Rejects with an AuthError on failure; the Login page shows the message.
  const login = useCallback(async (identifier, password) => {
    const signedIn = await authService.login(identifier, password);
    setNotice("");
    setMember(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setMember(null);
    // Clear member-specific library state (loans, history, holds) on logout.
    // Public book catalog is intentionally left intact.
    useLibraryStore.getState().clearMemberState();
  }, []);

  // Experiment 4f — the API answered 401 (invalid or expired token). The
  // interceptor already dropped the token; end the local session too so the
  // header switches back to "Login", and explain why. The ref flip happens
  // synchronously, which stops the follow-up /auth/logout 401 from looping.
  useEffect(() => {
    const onAuthExpired = () => {
      if (!memberRef.current) return;
      memberRef.current = null;
      setNotice("Your session has expired. Please sign in again.");
      authService.logout().catch(() => {});
      setMember(null);
      useLibraryStore.getState().clearMemberState();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, []);

  const value = useMemo(
    () => ({
      member,
      isAuthenticated: member !== null,
      isInitializing,
      notice,
      login,
      logout,
    }),
    [member, isInitializing, notice, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
}

export default AuthContext;
