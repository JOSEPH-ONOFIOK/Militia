"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { checkProof, isValidWallet, maybeApprove, toPublic, type MissionId, type PublicRecruit, type Recruit } from "@/lib/game";
import { isValidHandle, normalizeHandle, soldierIdForHandle } from "@/lib/swole";

export type AuthInfo = { mode: "x" | "handle"; storage: "server" | "local"; turnstileSiteKey: string | null };

// ---------- browser storage (used while no database is configured) ----------
type LocalDb = { me: string | null; recruits: Record<string, Recruit> };
const LOCAL = "swole:local";

function readLocal(): LocalDb {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL) ?? "");
    if (v && typeof v === "object" && v.recruits) return v as LocalDb;
  } catch {}
  return { me: null, recruits: {} };
}

function writeLocal(db: LocalDb) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(db));
  } catch {}
}

// Applies an action to the stored recruit, mirroring the server routes
function localAction(r: Recruit, path: string, body: Record<string, unknown>): string | null {
  switch (path) {
    case "/api/mission": {
      const m = String(body.mission) as MissionId;
      const proof = checkProof(m, body.proof);
      if (!proof.ok) return proof.error;
      r.missions[m] ??= Date.now();
      if (proof.value) r.proofs = { ...r.proofs, [m]: proof.value };
      if (m === "follow") {
        r.approval = { ...r.approval, follow: r.approval?.follow ?? Date.now() };
        maybeApprove(r);
      }
      return null;
    }
    case "/api/wallet": {
      const w = String(body.wallet ?? "").trim();
      if (!isValidWallet(w)) return "That isn't a valid Robinhood Chain or Ethereum address. It should start with 0x followed by 40 characters.";
      r.wallet = w;
      return null;
    }
    default:
      return "Not available";
  }
}

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
  const approvedRef = useRef(false);
  useEffect(() => {
    xpRef.current = recruit?.xp ?? null;
    approvedRef.current = !!recruit?.approved;
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
        setAuth(d.auth);
        if (d.auth?.storage === "local") {
          const db = readLocal();
          const r = db.me ? db.recruits[db.me] : null;
          setRecruit(r ? toPublic(r) : null);
        } else setRecruit(d.recruit);
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
    if (auth?.storage === "local") {
      const h = normalizeHandle(handle);
      if (!isValidHandle(h)) return { error: "That isn't a valid X handle." };
      const db = readLocal();
      const isNew = !db.recruits[h];
      if (isNew) {
        const ref = normalizeHandle(loadRef() ?? "");
        db.recruits[h] = {
          handle: h,
          soldierId: soldierIdForHandle(h),
          referredBy: ref && ref !== h ? ref : undefined,
          referrals: 0,
          missions: {},
          createdAt: Date.now(),
        };
      }
      db.me = h;
      writeLocal(db);
      const pub = toPublic(db.recruits[h]);
      setRecruit(pub);
      return { isNew, recruit: pub };
    }
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
  }, [auth]);

  const call = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    if (auth?.storage === "local") {
      const db = readLocal();
      const r = db.me ? db.recruits[db.me] : null;
      if (!r) return { error: "Please sign in first." };
      const before = toPublic(r).xp;
      const wasApproved = !!r.approval?.at;
      let error: string | null = null;
      if (path === "/api/approval") {
        // the server checks the reply on X; the result is kept in this browser
        if (body.step === "reply") {
          const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, handle: r.handle }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) return { error: (d.error as string) ?? "Couldn't check your reply." };
          r.approval = { ...r.approval, reply: d.link };
        } else if (body.step === "follow" || body.step === "repost") {
          r.approval = { ...r.approval, [body.step]: r.approval?.[body.step] ?? Date.now() };
          if (body.step === "follow") r.missions.follow ??= Date.now();
        }
        maybeApprove(r);
      } else error = localAction(r, path, body);
      if (error) return { error };
      writeLocal(db);
      const pub = toPublic(r);
      setRecruit(pub);
      if (pub.xp > before) window.dispatchEvent(new CustomEvent("swole:xp", { detail: { gain: pub.xp - before, before, after: pub.xp } }));
      if (pub.approved && !wasApproved) window.dispatchEvent(new Event("swole:approved"));
      return {};
    }
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (d.error as string) ?? "Something went wrong." };
    if (d.recruit) {
      const gained = xpRef.current === null ? 0 : d.recruit.xp - xpRef.current;
      if (d.recruit.approved && !approvedRef.current) window.dispatchEvent(new Event("swole:approved"));
      setRecruit(d.recruit);
      if (gained > 0) window.dispatchEvent(new CustomEvent("swole:xp", { detail: { gain: gained, before: xpRef.current!, after: d.recruit.xp } }));
    }
    intelChanged();
    return {};
  }, [auth]);

  const signOut = useCallback(async () => {
    if (auth?.storage === "local") {
      const db = readLocal();
      db.me = null;
      writeLocal(db);
    } else await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setRecruit(null);
  }, [auth]);

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
