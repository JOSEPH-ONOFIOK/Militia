"use client";

import { useEffect, useRef } from "react";

type TS = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TS;
  }
}

let loader: Promise<void> | null = null;
function load() {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loader;
}

// Cloudflare Turnstile bot check. Calls onToken with a fresh token, or null when it expires.
export default function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    let id: string | undefined;
    let alive = true;
    load().then(() => {
      if (!alive || !el.current || !window.turnstile) return;
      id = window.turnstile.render(el.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    });
    return () => {
      alive = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey]);

  return <div ref={el} className="turnstile" />;
}
