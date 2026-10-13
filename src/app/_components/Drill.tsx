"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { LuBiohazard, LuCheck, LuCrosshair, LuFlame, LuPlay, LuRotateCcw, LuTimer, LuTrophy, LuVolume2, LuVolumeX, LuX } from "react-icons/lu";
import { ALL_SOLDIERS, gifSrc, isInfected } from "@/lib/swole";
import { X_HANDLE } from "@/lib/game";
import { beep, chord, err, setSound, soundOn } from "./sound";

const INFECTED = ALL_SOLDIERS.filter(isInfected).map((s) => s.id);
const CLEAN = ALL_SOLDIERS.filter((s) => !isInfected(s)).map((s) => s.id);
// Examples for the brief: one of each infection type
const EX_SKIN = ALL_SOLDIERS.find((s) => s.traits.Skin === "Infected" && s.traits.Eyes !== "Infected")!.id;
const EX_EYES = ALL_SOLDIERS.find((s) => s.traits.Eyes === "Infected" && s.traits.Skin !== "Infected")!.id;
const pick = (a: number[]) => a[Math.floor(Math.random() * a.length)];
const CELLS = 9;
const ROUND = 30;
// Waves start slow and speed up as the clock runs down
const WAVE_START = 2800;
const WAVE_END = 1500;

type Cell = { id: number; bad: boolean; state?: "hit" | "miss" };
type Stats = { hits: number; misses: number; streak: number; bestStreak: number };

function wave(): Cell[] {
  const n = 1 + Math.floor(Math.random() * 3);
  const cells: Cell[] = Array.from({ length: CELLS }, () => ({ id: pick(CLEAN), bad: false }));
  const slots = [...cells.keys()].sort(() => Math.random() - 0.5).slice(0, n);
  for (const i of slots) cells[i] = { id: pick(INFECTED), bad: true };
  return cells;
}

// Each hit is worth 1, or 2 once you chain 5 in a row, or 3 from 10 in a row
const bonusFor = (streak: number) => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1);
const buzz = (p: number | number[]) => navigator.vibrate?.(p);

// INFECTION SWEEP: tap every soldier with Infected skin or eyes. Friendly fire costs 2.
export default function Drill({ best, onStart, onFinish, onClose }: { best?: number; onStart?: () => void; onFinish: (score: number) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<"brief" | "live" | "over">("brief");
  const [cells, setCells] = useState<Cell[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(ROUND);
  const [stats, setStats] = useState<Stats>({ hits: 0, misses: 0, streak: 0, bestStreak: 0 });
  const [prevBest] = useState(best ?? 0);
  const [snd, setSnd] = useState(soundOn);
  function toggleSound() {
    const v = !soundOn();
    setSound(v);
    setSnd(v);
    if (v) chord();
  }
  const waveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clock = useRef<ReturnType<typeof setInterval>>(undefined);
  const endAt = useRef(0);
  const scoreRef = useRef(0);
  const statsRef = useRef<Stats>({ hits: 0, misses: 0, streak: 0, bestStreak: 0 });
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  const nextWave = useCallback(function next() {
    clearTimeout(waveTimer.current);
    setCells(wave());
    const progress = 1 - Math.max(0, endAt.current - Date.now()) / (ROUND * 1000);
    waveTimer.current = setTimeout(next, WAVE_START - (WAVE_START - WAVE_END) * progress);
  }, []);

  function start() {
    onStart?.();
    scoreRef.current = 0;
    statsRef.current = { hits: 0, misses: 0, streak: 0, bestStreak: 0 };
    setScore(0);
    setStats(statsRef.current);
    setTime(ROUND);
    setPhase("live");
    endAt.current = Date.now() + ROUND * 1000;
    nextWave();
    clearInterval(clock.current);
    clock.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setTime(left);
      if (left === 0) {
        clearTimeout(waveTimer.current);
        clearInterval(clock.current);
        setPhase("over");
        buzz([40, 50, 80]);
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
    const st = { ...statsRef.current };
    if (c.bad) {
      st.hits += 1;
      st.streak += 1;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      scoreRef.current += bonusFor(st.streak);
      beep(st.streak >= 5 ? 1500 : 1200, 0.04);
      buzz(12);
    } else {
      st.misses += 1;
      st.streak = 0;
      scoreRef.current -= 2;
      err();
      buzz([30, 40, 30]);
    }
    statsRef.current = st;
    setStats(st);
    setScore(scoreRef.current);
    if (c.bad && next.every((x) => !x.bad || x.state === "hit")) setTimeout(nextWave, 160);
  }

  function shareScore() {
    const text = `I cleared ${Math.max(0, score)} infected in the @${X_HANDLE} Infection Sweep 🧟 Best streak ${stats.bestStreak}.\n\nThink you can beat it? 👇`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.origin)}`, "_blank", "noopener");
  }

  const final = Math.max(0, score);
  const shots = stats.hits + stats.misses;
  const accuracy = shots ? Math.round((stats.hits / shots) * 100) : 0;
  const mult = bonusFor(stats.streak);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="frame drill" role="dialog" aria-labelledby="drill-title" onClick={(e) => e.stopPropagation()}>
        <div className="frame-head">
          <span id="drill-title" className="ph-title"><LuBiohazard aria-hidden />Infection Sweep</span>
          <span className="frame-actions">
            <button className={`icon-btn sm sound-btn ${snd ? "on" : ""}`} onClick={toggleSound} aria-pressed={snd} aria-label={snd ? "Turn sound off" : "Turn sound on"} title={snd ? "Sound on" : "Sound off"}>
              {snd ? <LuVolume2 /> : <LuVolumeX />}
            </button>
            <button className="icon-btn sm" onClick={onClose} aria-label="Close"><LuX /></button>
          </span>
        </div>

        {phase !== "over" && (
          <div className="drill-hud">
            <div><span className="k"><LuTimer aria-hidden />Time</span><b className={time <= 5 && phase === "live" ? "red" : ""}>{String(time).padStart(2, "0")}</b></div>
            <div><span className="k"><LuCrosshair aria-hidden />Kills</span><b className="green">{score}</b></div>
            {phase === "live" ? (
              <div><span className="k"><LuFlame aria-hidden />Streak</span><b className={stats.streak >= 5 ? "amber" : ""}>{stats.streak}</b></div>
            ) : best !== undefined && (
              <div><span className="k"><LuTrophy aria-hidden />Best</span><b>{best}</b></div>
            )}
            {phase === "live" && mult > 1 && <span className="combo" key={mult}>×{mult} combo</span>}
          </div>
        )}

        {phase === "live" && (
          <>
            <div className="drill-time"><i style={{ width: `${(time / ROUND) * 100}%` }} /></div>
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
          </>
        )}

        {phase === "brief" && (
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
              <li><LuFlame className="amber" aria-hidden /><span>Chain hits for <b>×2</b> at 5 and <b>×3</b> at 10</span></li>
              <li><LuX className="red" aria-hidden /><span><b>−2</b> for a clean soldier, and your streak resets</span></li>
              <li><LuTimer aria-hidden /><span>{ROUND} seconds. Waves speed up as time runs out</span></li>
            </ul>
            <button className="btn btn-primary btn-lg" onClick={start}><LuPlay aria-hidden />Begin sweep</button>
          </div>
        )}

        {phase === "over" && (
          <div className="drill-over">
            <span className="eyebrow">{final > prevBest ? "New personal best" : "Sweep complete"}</span>
            <div className="over-score"><b>{final}</b><span>kills</span></div>
            <div className="over-stats">
              <div><b>{accuracy}%</b><span>Accuracy</span></div>
              <div><b>{stats.bestStreak}</b><span>Best streak</span></div>
              <div><b>{Math.max(final, prevBest)}</b><span>Best run</span></div>
            </div>
            <div className="over-actions">
              <button className="btn btn-primary btn-lg" onClick={start}><LuRotateCcw aria-hidden />Run it again</button>
              <button className="btn btn-x btn-lg" onClick={shareScore}><FaXTwitter aria-hidden />Share score</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
