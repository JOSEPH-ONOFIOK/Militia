"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicRecruit } from "@/lib/game";

export type AuthInfo = { mode: "x" | "handle"; turnstileSiteKey: string | null };

type Ctx = {
  recruit: PublicRecruit | null;
  auth: AuthInfo | null;
  ready: boolean;
  signIn: (turnstileToken?: string) => void;
  devSignIn: (handle: string, cf?: string) => Promise<{ error?: string; isNew?: boolean; recruit?: PublicRecruit }>;
  call: (path: string, body?: Record<string, unknown>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  toast: (msg: string) => void;
};

const SessionCtx = createContext<Ctx | null>(null);
const REF = "swole:ref";

const loadRef = () => {
  try {
    return localStorage.getItem(REF);
  } catch {
    return null;
  }
};

export const intelChanged = () => window.dispatchEvent(new Event("swole:intel"));

export function SessionProvider({ children }: { children: ReactNode }) {
  const [recruit, setRecruit] = useState<PublicRecruit | null>(null);
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const xpRef = useRef<number | null>(null);
  useEffect(() => {
    xpRef.current = recruit?.xp ?? null;
  }, [recruit]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 2800);
  }, []);

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) {
      try {
        localStorage.setItem(REF, ref);
      } catch {}
    }
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setRecruit(d.recruit);
        setAuth(d.auth);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((turnstileToken?: string) => {
    const q = new URLSearchParams();
    const ref = loadRef();
    if (ref) q.set("ref", ref);
    if (turnstileToken) q.set("cf", turnstileToken);
    // Full page navigation: the route handler redirects to X's consent screen
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = `/api/auth/x/start?${q}`;
  }, []);

  const devSignIn = useCallback(async (handle: string, cf?: string) => {
    const res = await fetch("/api/auth/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, ref: loadRef(), cf }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (d.error as string) ?? "Sign in failed. Please try again." };
    setRecruit(d.recruit);
    intelChanged();
    return { isNew: d.isNew as boolean, recruit: d.recruit as PublicRecruit };
  }, []);

  const call = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (d.error as string) ?? "Something went wrong." };
    if (d.recruit) {
      const gained = xpRef.current === null ? 0 : d.recruit.xp - xpRef.current;
      setRecruit(d.recruit);
      if (gained > 0) window.dispatchEvent(new CustomEvent("swole:xp", { detail: gained }));
    }
    intelChanged();
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setRecruit(null);
  }, []);

  return (
    <SessionCtx.Provider value={{ recruit, auth, ready, signIn, devSignIn, call, signOut, toast }}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </SessionCtx.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession outside SessionProvider");
  return c;
}
