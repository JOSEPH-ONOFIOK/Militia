"use client";

import { useEffect, useRef, useState } from "react";
import { RANKS, rankFor } from "@/lib/game";

export type Blip = { handle: string; xp: number; approved?: boolean };

const TAU = Math.PI * 2;
const SWEEP_MS = 4200;

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0xffffffff;
}

// Rank pulls you toward command (the center). Angle is fixed per handle.
// Each rank gets an even band; progress inside a rank moves you through its band.
function ringFor(xp: number) {
  const r = rankFor(xp);
  const frac = r.next ? (xp - r.min) / (r.next.min - r.min) : 0.5;
  return 0.94 - ((r.index + frac) / RANKS.length) * 0.8;
}
function place(b: Blip) {
  return { a: hash(b.handle) * TAU, r: ringFor(b.xp) - hash(b.handle + "~") * 0.06 };
}

export default function Radar({ blips, me }: { blips: Blip[]; me?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useRef({ blips, me, seen: new Map<string, number>() });
  const [hover, setHover] = useState<{ x: number; y: number; b: Blip } | null>(null);

  useEffect(() => {
    const d = data.current;
    const now = performance.now();
    // New blips get a ping ring (but not everyone on the first load)
    const first = d.seen.size === 0;
    for (const b of blips) if (!d.seen.has(b.handle)) d.seen.set(b.handle, first ? 0 : now);
    d.blips = blips;
    d.me = me;
    if (me && !d.seen.get(me)) d.seen.set(me, now);
  }, [blips, me]);

  useEffect(() => {
    const cv = canvas.current!;
    const g = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let size = 0;

    const fit = () => {
      const rect = wrap.current!.getBoundingClientRect();
      size = Math.floor(Math.min(rect.width, rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = cv.height = size * dpr;
      cv.style.width = cv.style.height = size + "px";
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current!);
    fit();

    const draw = (t: number) => {
      const { blips, me, seen } = data.current;
      const c = size / 2;
      const R = c - 18;
      if (R < 20) {
        // hidden (e.g. another tab on phones): skip drawing until it has room again
        raf = requestAnimationFrame(draw);
        return;
      }
      const sweep = reduce ? -Math.PI / 2 : ((t % SWEEP_MS) / SWEEP_MS) * TAU - Math.PI / 2;

      g.clearRect(0, 0, size, size);
      const bg = g.createRadialGradient(c, c, 0, c, c, R);
      bg.addColorStop(0, "rgba(60,110,30,.22)");
      bg.addColorStop(1, "rgba(10,20,6,.05)");
      g.fillStyle = bg;
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.fill();

      // rings + crosshair + bearing ticks
      g.strokeStyle = "rgba(157,255,106,.16)";
      g.lineWidth = 1;
      for (const rk of RANKS) {
        g.beginPath();
        g.arc(c, c, ringFor(rk.min) * R, 0, TAU);
        g.stroke();
      }
      g.strokeStyle = "rgba(157,255,106,.3)";
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.stroke();
      g.beginPath();
      g.moveTo(c - R, c); g.lineTo(c + R, c);
      g.moveTo(c, c - R); g.lineTo(c, c + R);
      g.stroke();
      for (let d = 0; d < 360; d += 5) {
        const a = (d * Math.PI) / 180;
        const len = d % 30 === 0 ? 10 : 4;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        g.lineTo(c + Math.cos(a) * (R + len), c + Math.sin(a) * (R + len));
        g.strokeStyle = d % 30 === 0 ? "rgba(157,255,106,.5)" : "rgba(157,255,106,.2)";
        g.stroke();
      }
      g.fillStyle = "rgba(141,232,104,.5)";
      g.font = "500 9px ui-sans-serif, system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("COMMAND", c, c - 6);
      g.textAlign = "left";
      for (const rk of RANKS) {
        const y = c - (ringFor(rk.min) - 0.8 / RANKS.length / 2) * R;
        g.fillText(rk.name, c + 6, y + 3);
      }
      g.textAlign = "center";

      // sweep wedge
      if ("createConicGradient" in g) {
        const cg = g.createConicGradient(sweep - 0.9, c, c);
        cg.addColorStop(0, "rgba(157,255,106,0)");
        cg.addColorStop(0.143, "rgba(157,255,106,.28)");
        cg.addColorStop(0.1432, "rgba(157,255,106,0)");
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(c, c);
        g.arc(c, c, R, sweep - 0.9, sweep);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = "rgba(190,255,150,.9)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R);
      g.stroke();

      // blips
      for (const b of blips) {
        const p = place(b);
        const x = c + Math.cos(p.a) * p.r * R;
        const y = c + Math.sin(p.a) * p.r * R;
        let since = (sweep - p.a) % TAU;
        if (since < 0) since += TAU;
        const glow = reduce ? 0.9 : Math.max(0.18, 1 - since / 4.2);
        const mine = b.handle === me;
        const secured = !!b.approved || rankFor(b.xp).index >= 4; // cleared: approved, or Lieutenant and up
        const col = mine ? "255,92,72" : secured ? "255,184,48" : "141,232,104";
        g.fillStyle = `rgba(${col},${mine ? 1 : glow})`;
        g.shadowColor = `rgba(${col},1)`;
        g.shadowBlur = mine ? 14 : 8 * glow;
        if (mine) g.fillRect(x - 3, y - 3, 6, 6);
        else if (secured) {
          g.beginPath();
          g.moveTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.lineTo(x - 4, y);
          g.closePath();
          g.fill();
        } else {
          g.beginPath();
          g.arc(x, y, 2, 0, TAU);
          g.fill();
        }
        g.shadowBlur = 0;

        const born = seen.get(b.handle) ?? 0;
        const age = t - born;
        if (born && age < 2400) {
          g.strokeStyle = `rgba(${col},${1 - age / 2400})`;
          g.beginPath();
          g.arc(x, y, 4 + (age / 2400) * 30, 0, TAU);
          g.stroke();
        }
        if (mine) {
          const pulse = 8 + ((t / 90) % 14);
          g.strokeStyle = `rgba(${col},${1 - (pulse - 8) / 14})`;
          g.beginPath();
          g.arc(x, y, pulse, 0, TAU);
          g.stroke();
          g.fillStyle = "rgba(255,120,100,1)";
          g.font = "600 11px ui-sans-serif, system-ui, sans-serif";
          g.textAlign = "left";
          g.fillText(`You  @${b.handle}`, x + 10, y - 8);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function onMove(e: React.PointerEvent) {
    const rect = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const c = rect.width / 2;
    const R = c - 18;
    let best: { d: number; b: Blip; x: number; y: number } | null = null;
    for (const b of data.current.blips) {
      const p = place(b);
      const x = c + Math.cos(p.a) * p.r * R;
      const y = c + Math.sin(p.a) * p.r * R;
      const d = Math.hypot(mx - x, my - y);
      if (d < 12 && (!best || d < best.d)) best = { d, b, x, y };
    }
    setHover(best ? { x: best.x, y: best.y, b: best.b } : null);
  }

  return (
    <div ref={wrap} className="radar-wrap">
      <div style={{ position: "relative" }}>
        <canvas ref={canvas} onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        {hover && (
          <div className="radar-tip" style={{ left: hover.x, top: hover.y }}>
            @{hover.b.handle} · {rankFor(hover.b.xp).name} · {hover.b.xp}XP
          </div>
        )}
      </div>
    </div>
  );
}
