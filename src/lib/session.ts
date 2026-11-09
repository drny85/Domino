"use client";

import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "domino.sessionId";
const NAME_KEY = "domino.playerName";
/** Per-tab override so one browser can play several seats (testing). */
const TAB_SESSION_KEY = "domino.tabSessionId";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function safeGet(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

export function readSession(): { sessionId: string; name: string; isTabIdentity: boolean } {
  const ls = typeof window !== "undefined" ? window.localStorage : undefined;
  const ss = typeof window !== "undefined" ? window.sessionStorage : undefined;
  const tabId = safeGet(ss, TAB_SESSION_KEY);
  let sessionId = tabId ?? safeGet(ls, SESSION_KEY);
  if (!sessionId) {
    sessionId = makeId();
    safeSet(ls, SESSION_KEY, sessionId);
  }
  const name = (tabId ? safeGet(ss, NAME_KEY) : null) ?? safeGet(ls, NAME_KEY) ?? "";
  return { sessionId, name, isTabIdentity: !!tabId };
}

export type Session = { sessionId: string; name: string; isTabIdentity: boolean };

/** Guest identity: persistent sessionId + display name in localStorage. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(readSession());
  }, []);

  const setName = useCallback((name: string) => {
    setSession((s) => {
      if (!s) return s;
      const store = s.isTabIdentity ? window.sessionStorage : window.localStorage;
      safeSet(store, NAME_KEY, name);
      return { ...s, name };
    });
  }, []);

  /** Gives this tab its own identity, to play another seat from the same browser. */
  const newTabIdentity = useCallback(() => {
    const id = makeId();
    safeSet(window.sessionStorage, TAB_SESSION_KEY, id);
    safeSet(window.sessionStorage, NAME_KEY, "");
    setSession({ sessionId: id, name: "", isTabIdentity: true });
  }, []);

  return { session, setName, newTabIdentity };
}
