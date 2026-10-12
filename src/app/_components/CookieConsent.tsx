"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuCookie } from "react-icons/lu";

export const CONSENT_COOKIE = "swole_consent";
export type Consent = "all" | "essential";

export function readConsent(): Consent | null {
  const m = document.cookie.match(/(?:^|; )swole_consent=(all|essential)/);
  return (m?.[1] as Consent) ?? null;
}

// Optional analytics should only load when this returns true.
export const analyticsAllowed = () => readConsent() === "all";

function saveConsent(v: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${v}; Path=/; Max-Age=${180 * 86400}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("swole:consent"));
}

export function resetConsent() {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
  window.dispatchEvent(new Event("swole:consent"));
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setOpen(readConsent() === null);
    const t = setTimeout(check, 600); // let the page settle before asking
    window.addEventListener("swole:consent", check);
    return () => {
      clearTimeout(t);
      window.removeEventListener("swole:consent", check);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-body">
      <div className="consent-head">
        <span className="consent-icon" aria-hidden><LuCookie /></span>
        <h2 id="consent-title">Cookies on Swolediers</h2>
      </div>
      <p id="consent-body">
        We use essential cookies to keep you signed in and to protect the site from bots. If you accept, we may also use
        analytics cookies to understand how people use the war room. You can change your choice at any time.
      </p>
      <div className="consent-actions">
        <button className="consent-btn primary" onClick={() => saveConsent("all")}>Accept all</button>
        <button className="consent-btn" onClick={() => saveConsent("essential")}>Essential only</button>
        <Link href="/privacy" className="consent-link">Privacy and cookies</Link>
      </div>
    </div>
  );
}
