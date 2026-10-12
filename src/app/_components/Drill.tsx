"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ALL_SOLDIERS, gifSrc, isInfected } from "@/lib/swole";
import { beep, err } from "./sound";
import { LuBiohazard, LuCheck, LuCrosshair, LuPlay, LuRotateCcw, LuTimer, LuTrophy, LuX } from "react-icons/lu";

const INFECTED = ALL_SOLDIERS.filter(isInfected).map((s) => s.id);
// Examples for the brief: one of each infection type
const EX_SKIN = ALL_SOLDIERS.find((s) => s.traits.Skin === "Infected" && s.traits.Eyes !== "Infected")!.id;
const EX_EYES = ALL_SOLDIERS.find((s) => s.traits.Eyes === "Infected" && s.traits.Skin !== "Infected")!.id;
const CLEAN = ALL_SOLDIERS.filter((s) => !isInfected(s)).map((s) => s.id);
const pick = (a: number[]) => a[Math.floor(Math.random() * a.length)];
const CELLS = 9;
const ROUND = 30;
const WAVE_MS = 2800;

type Cell = { id: number; bad: boolean; state?: "hit" | "miss" };

function wave(): Cell[] {
  const n = 1 + Math.floor(Math.random() * 3);
  const cells: Cell[] = Array.from({ length: CELLS }, () => ({ id: pick(CLEAN), bad: false }));
  const slots = [...cells.keys()].sort(() => Math.random() - 0.5).slice(0, n);
  for (const i of slots) cells[i] = { id: pick(INFECTED), bad: true };
  return cells;
}

// INFECTION SWEEP: tap every soldier with Infected skin or eyes. Friendly fire costs 2.
export default function Drill({ best, onStart, onFinish, onClose }: { best?: number; onStart?: () => void; onFinish: (score: number) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<"brief" | "live" | "over">("brief");
  const [cells, setCells] = useState<Cell[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND);
  const waveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clock = useRef<ReturnType<typeof setInterval>>(undefined);
  const scoreRef = useRef(0);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  const nextWave = useCallback(function next() {
    clearTimeout(waveTimer.current);
    setCells(wave());
    waveTimer.current = setTimeout(next, WAVE_MS);
  }, []);

  function start() {
    onStart?.();
    scoreRef.current = 0;
    setScore(0);
    setTime(ROUND);
    setPhase("live");
    nextWave();
    const endAt = Date.now() + ROUND * 1000;
    clearInterval(clock.current);
    clock.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTime(left);
      if (left === 0) {
        clearTimeout(waveTimer.current);
        clearInterval(clock.current);
        setPhase("over");
        finishRef.current(Math.max(0, scoreRef.current));
      }
    }, 250);
  }

  useEffect(() => () => {
    clearTimeout(waveTimer.current);
    clearInterval(clock.current);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function shoot(i: number) {
    if (phase !== "live" || cells[i].state) return;
    const c = cells[i];
    const next = cells.map((x, j) => (j === i ? { ...x, state: c.bad ? ("hit" as const) : ("miss" as const) } : x));
    setCells(next);
    scoreRef.current += c.bad ? 1 : -2;
    setScore(scoreRef.current);
    if (c.bad) beep(1200, 0.04);
    else err();
    if (c.bad && next.every((x) => !x.bad || x.state === "hit")) setTimeout(nextWave, 160);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="frame drill" role="dialog" aria-labelledby="drill-title" onClick={(e) => e.stopPropagation()}>
        <div className="frame-head">
          <span id="drill-title" className="ph-title"><LuBiohazard aria-hidden />Infection Sweep</span>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close"><LuX /></button>
        </div>
        <div className="drill-hud">
          <div><span className="k"><LuTimer aria-hidden />Time</span><b className={time <= 5 && phase === "live" ? "red" : ""}>{String(time).padStart(2, "0")}</b></div>
          <div><span className="k"><LuCrosshair aria-hidden />Kills</span><b className="green">{score}</b></div>
          {best !== undefined && <div><span className="k"><LuTrophy aria-hidden />Best</span><b>{best}</b></div>}
        </div>
        {phase === "live" ? (
          <div className="drill-grid">
            <div className="thermal" aria-hidden />
            {cells.map((c, i) => (
              <button key={i + ":" + c.id} className={`drill-cell ${c.bad ? "bad" : ""} ${c.state ?? ""}`} style={{ ["--row" as string]: Math.floor(i / 3) }} onPointerDown={() => shoot(i)} aria-label="Soldier">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gifSrc(c.id)} alt="" className="px" draggable={false} />
                {c.bad && !c.state && <LuBiohazard className="bio" aria-hidden />}
                {c.state && <span className="mark">{c.state === "hit" ? <LuCheck /> : <LuX />}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="drill-brief">
            <p>The outbreak is inside the ranks. Your thermal scanner makes infected soldiers <b className="green">glow green</b>. Tap them before the wave moves on.</p>
            <div className="ex-row">
              {[[EX_SKIN, "Green skin"], [EX_EYES, "Red glowing eyes"]].map(([id, label]) => (
                <figure key={id} className="ex">
                  <div className="drill-cell bad static">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gifSrc(id as number)} alt="" className="px" />
                    <LuBiohazard className="bio" aria-hidden />
                  </div>
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
            <ul className="rules">
              <li><LuCheck className="green" aria-hidden /><span><b>+1</b> for each infected soldier</span></li>
              <li><LuX className="red" aria-hidden /><span><b>−2</b> for hitting a clean soldier</span></li>
              <li><LuTimer aria-hidden /><span>{ROUND} seconds. Your best run counts, 10 XP per kill</span></li>
            </ul>
            {phase === "over" && <p className="result"><LuTrophy aria-hidden /> Sweep complete: <b>{Math.max(0, score)}</b> confirmed kills</p>}
            <button className="btn btn-primary btn-lg" onClick={start}>
              {phase === "over" ? <><LuRotateCcw aria-hidden />Run it again</> : <><LuPlay aria-hidden />Begin sweep</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
