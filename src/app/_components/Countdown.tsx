"use client";

import { useEffect, useState } from "react";
import { LuTimer } from "react-icons/lu";

// Set NEXT_PUBLIC_SNAPSHOT_AT (an ISO date such as 2026-11-01T18:00:00Z) to show the countdown
const TARGET = process.env.NEXT_PUBLIC_SNAPSHOT_AT ? Date.parse(process.env.NEXT_PUBLIC_SNAPSHOT_AT) : NaN;

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function useCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (Number.isNaN(TARGET)) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  if (Number.isNaN(TARGET) || now === null) return null;
  return { left: TARGET - now, ...parts(TARGET - now) };
}

const two = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ variant = "pill" }: { variant?: "pill" | "block" }) {
  const c = useCountdown();
  if (!c) return null;
  const done = c.left <= 0;
  if (variant === "pill") {
    return (
      <span className={`countdown ${done ? "done" : ""}`} title="Allowlist snapshot">
        <LuTimer aria-hidden />
        {done ? "Snapshot taken" : <>Snapshot in <b>{c.d}d {two(c.h)}h {two(c.m)}m</b></>}
      </span>
    );
  }
  return (
    <div className={`countdown-block ${done ? "done" : ""}`}>
      <span className="eyebrow"><LuTimer aria-hidden />{done ? "Snapshot taken" : "Allowlist snapshot in"}</span>
      {!done && (
        <div className="cd-units">
          {([["d", c.d], ["h", c.h], ["m", c.m], ["s", c.s]] as const).map(([k, v]) => (
            <span key={k}><b>{k === "d" ? v : two(v)}</b>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
