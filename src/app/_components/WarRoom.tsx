"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MISSIONS, PINNED_POST, RANKS, SECURED_AT, X_HANDLE, X_PROFILE, XP, rankFor, type MissionId, type PublicRecruit } from "@/lib/game";
import { CATEGORIES, SUPPLY, getSoldier, gifSrc, isValidHandle, normalizeHandle, rarityClass, serialFor, traitPct } from "@/lib/swole";
import { useSession } from "./session";
import Radar, { type Blip } from "./Radar";
import Decode from "./Decode";
import Drill from "./Drill";
import Turnstile from "./Turnstile";
import { beep, chord, err, setSound, soundOn } from "./sound";
import type { IconType } from "react-icons";
import { FaXTwitter } from "react-icons/fa6";
import {
  LuArrowDown, LuArrowRight, LuArrowUpRight, LuBell, LuBiohazard, LuCheck, LuChevronRight, LuCircleHelp, LuCrosshair,
  LuDownload, LuGauge, LuLink, LuListChecks, LuLock, LuLogIn, LuLogOut, LuMedal, LuRadar, LuRepeat2, LuShare2,
  LuShieldCheck, LuSparkles, LuTarget, LuTerminal, LuTrophy, LuUserPlus, LuUserRound, LuUsers, LuVolume2, LuVolumeX,
  LuWallet, LuX, LuZap,
} from "react-icons/lu";

type Tone = "ink" | "dim" | "amber" | "green" | "red" | "echo" | "pink";
type Line = { id: number; text: string; tone: Tone };
type Intel = { count: number; top: PublicRecruit[]; recent: { handle: string; soldierId: number }[]; blips: Blip[] };
type Focus = { id: number; handle?: string };

const MISSION_LINK: Record<MissionId, string> = {
  follow: `https://x.com/intent/follow?screen_name=${X_HANDLE}`,
  repost: PINNED_POST,
  share: "",
  notify: X_PROFILE,
};

const pad = (n: number, w = 4) => String(n).padStart(w, "0");

const QUICK: Record<string, string> = {
  status: "My rank", orders: "Tasks", share: "Share card", recruit: "Invite link",
  drill: "Play sweep", card: "Download card", help: "Help", board: "Leaderboard", login: "Sign in", logout: "Sign out",
};

const QUICK_ICON: Record<string, IconType> = {
  status: LuGauge, orders: LuListChecks, share: LuShare2, recruit: LuLink, drill: LuBiohazard,
  card: LuDownload, help: LuCircleHelp, board: LuTrophy, login: LuLogIn,
};

const TASK_ICON: Record<string, IconType> = {
  follow: LuUserPlus, repost: LuRepeat2, share: LuShare2, notify: LuBell,
  drill: LuBiohazard, wallet: LuWallet, recruit: LuUsers,
};

// The single most useful thing this recruit can do next
function nextStep(r: PublicRecruit): { cmd: string; title: string; xp: string } {
  const m = (id: MissionId) => MISSIONS.find((x) => x.id === id)!;
  if (!r.missions.follow) return { cmd: "follow", title: `Follow @${X_HANDLE} on X`, xp: `+${m("follow").xp}` };
  if (!r.missions.share) return { cmd: "share", title: "Post your draft card on X", xp: `+${m("share").xp}` };
  if (!r.missions.repost) return { cmd: "repost", title: "Like + repost the pinned post", xp: `+${m("repost").xp}` };
  if (!r.drillBest) return { cmd: "drill", title: "Play Infection Sweep", xp: `up to +${XP.drillMax}` };
  if (!r.hasWallet) return { cmd: "wallet", title: "Add your mint wallet", xp: `+${XP.wallet}` };
  if (!r.missions.notify) return { cmd: "notify", title: "Turn on post notifications", xp: `+${m("notify").xp}` };
  return { cmd: "recruit", title: "Invite friends with your link", xp: `+${XP.perReferral} each` };
}

export default function WarRoom() {
  const { recruit, auth, ready, signIn, devSignIn, call, signOut, toast } = useSession();
  const [intel, setIntel] = useState<Intel | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [busy, setBusy] = useState(false);
  const [drill, setDrill] = useState(false);
  const [snd, setSnd] = useState(false);
  const [tab, setTab] = useState<"you" | "tasks" | "board">("you");
  const [handleIn, setHandleIn] = useState("");
  const [cfToken, setCfToken] = useState<string | null>(null);
  const [coach, setCoach] = useState(false); // "start here" pointer to the tasks panel
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null);
  const sideRef = useRef<HTMLElement>(null);
  const signing = useRef(false);

  const queue = useRef<{ text: string; tone: Tone }[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const lineId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const booted = useRef(false);

  // ---------- typewriter ----------
  const pump = useCallback(() => {
    if (timer.current) return;
    let cur: Line | null = null;
    timer.current = setInterval(() => {
      const head = queue.current[0];
      if (!head) {
        clearInterval(timer.current);
        timer.current = undefined;
        return;
      }
      if (!cur) {
        cur = { id: ++lineId.current, text: "", tone: head.tone };
        const fresh = cur;
        setLines((l) => [...l.slice(-160), fresh]);
      }
      const step = head.tone === "echo" ? 99 : 3;
      const text = head.text.slice(0, cur.text.length + step);
      const id = cur.id;
      cur = { ...cur, text };
      setLines((l) => l.map((x) => (x.id === id ? { ...x, text } : x)));
      if (text.length % 9 === 0) beep(1800 + Math.random() * 400, 0.008, "square", 0.012);
      if (text.length >= head.text.length) {
        queue.current.shift();
        cur = null;
      }
    }, 12);
  }, []);

  const print = useCallback(
    (...items: (string | [string, Tone])[]) => {
      for (const it of items) queue.current.push(typeof it === "string" ? { text: it, tone: "ink" } : { text: it[0], tone: it[1] });
      pump();
    },
    [pump],
  );

  useEffect(() => () => clearInterval(timer.current), []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  // ---------- XP gain popups ----------
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      setGain((g) => ({ n, k: (g?.k ?? 0) + 1 }));
      setCoach(false);
      clearTimeout(t);
      t = setTimeout(() => setGain(null), 2200);
    };
    window.addEventListener("swole:xp", on);
    return () => {
      window.removeEventListener("swole:xp", on);
      clearTimeout(t);
    };
  }, []);

  // ---------- intel feed ----------
  useEffect(() => {
    const load = () => fetch("/api/intel").then((r) => r.json()).then(setIntel).catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    window.addEventListener("swole:intel", load);
    return () => {
      clearInterval(iv);
      window.removeEventListener("swole:intel", load);
    };
  }, []);

  // ---------- boot sequence ----------
  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    const q = new URLSearchParams(location.search);
    const drafted = q.has("drafted");
    const returning = q.has("welcome");
    const authError = q.get("auth_error");
    if (drafted || authError || q.has("welcome")) {
      ["drafted", "welcome", "auth_error"].forEach((k) => q.delete(k));
      window.history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : ""));
    }
    print(
      ["SWOLE-OS v4.444 // MILITIA COMMAND NETWORK", "dim"],
      ["ESTABLISHING UPLINK ............ OK", "dim"],
      [`PERSONNEL FILES ON RECORD ...... ${SUPPLY}`, "dim"],
      ["─────────────────────────────────────", "dim"],
    );
    if (authError) {
      const why: Record<string, string> = {
        cancelled: "SIGN IN CANCELLED.",
        expired: "SIGN IN EXPIRED. PLEASE TRY AGAIN.",
        handle_taken: "THAT HANDLE IS LINKED TO A DIFFERENT X ACCOUNT.",
        rate_limited: "TOO MANY ATTEMPTS. WAIT A FEW MINUTES.",
        bot_check: "SECURITY CHECK FAILED. PLEASE TRY AGAIN.",
        unavailable: "SIGN IN IS NOT OPEN YET.",
      };
      print([`! ${why[authError] ?? "SIGN IN FAILED. PLEASE TRY AGAIN."}`, "red"]);
    }
    if (recruit && drafted) {
      reveal(recruit);
    } else if (recruit) {
      if (returning) setTimeout(pointToTasks, 1500);
      const r = rankFor(recruit.xp);
      print(
        [`WELCOME BACK, ${r.name} @${recruit.handle.toUpperCase()}.`, "amber"],
        [`${recruit.xp} XP · ${r.next ? `${r.next.min - recruit.xp} XP TO ${r.next.name}` : "MAX RANK"}`, "ink"],
        ["TYPE 'orders' FOR YOUR TASKS, OR 'help'.", "dim"],
      );
    } else {
      print(
        ["THE DRAFT IS OPEN.", "amber"],
        ["YOU DON'T PICK YOUR SOLDIER. THE DRAFT DOES.", "ink"],
        ["ONE HANDLE. ONE SOLDIER. NO REROLLS.", "ink"],
        ["", "dim"],
        [auth?.mode === "handle" ? "IDENTIFY YOURSELF, RECRUIT. ENTER YOUR X HANDLE TO BEGIN." : "IDENTIFY YOURSELF, RECRUIT. SIGN IN WITH X TO BEGIN.", "green"],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, recruit, print]);

  // ---------- commands ----------
  // Plays the decrypt reveal for a freshly drafted recruit
  function reveal(r: PublicRecruit) {
    const s = getSoldier(r.soldierId);
    const rc = rarityClass(s.rank);
    setBusy(true);
    print(
      [`QUERYING DRAFT BOARD FOR @${r.handle.toUpperCase()} ...`, "dim"],
      [`MATCH FOUND · PERSONNEL FILE NO. ${pad(s.id)}`, "green"],
      ["DECRYPTING ................", "dim"],
    );
    setFocus({ id: s.id, handle: r.handle });
    setTimeout(() => {
      setBusy(false);
      chord();
      print(
        ["", "dim"],
        [`> DRAFTED: SWOLEDIER NO. ${pad(s.id)}`, "amber"],
        [`  CLASS ${rc.label} · RARITY RANK ${s.rank}/${SUPPLY}`, rc.tone === "mythic" ? "pink" : rc.tone === "grunt" ? "ink" : "amber"],
        ...CATEGORIES.map((c) => [`  ${c.toUpperCase().padEnd(11)}${s.traits[c].padEnd(18)}${traitPct(c, s.traits[c]).toFixed(1)}%`, "dim"] as [string, Tone]),
        [`  SERIAL ${serialFor(r.handle, s.id)}`, "dim"],
        ["", "dim"],
        ["YOU ARE ON THE RADAR. RANK: RECRUIT · 100 XP", "green"],
        [`REACH LIEUTENANT (${SECURED_AT} XP) TO SECURE THE ALLOWLIST.`, "ink"],
        
      );
      pointToTasks();
    }, 2900);
  }

  function pointToTasks() {
    setTab("tasks");
    setCoach(true);
    print(["> START HERE: YOUR TASKS ARE OPEN ON THE RIGHT. EACH ONE EARNS XP.", "amber"]);
  }

  function startSignIn() {
    if (auth?.mode === "handle") return print(["ENTER YOUR X HANDLE IN THE BOX ABOVE TO GET DRAFTED.", "amber"]);
    if (auth?.turnstileSiteKey && !cfToken) return print(["COMPLETE THE SECURITY CHECK FIRST.", "red"]);
    print(["OPENING SECURE UPLINK TO X ...", "green"]);
    signIn(cfToken ?? undefined);
  }

  async function devDraft(raw: string) {
    const h = normalizeHandle(raw);
    if (!isValidHandle(h)) {
      err();
      return print(["INVALID HANDLE. LETTERS, NUMBERS, _ · MAX 15.", "red"]);
    }
    if (signing.current) return;
    signing.current = true;
    setBusy(true);
    const res = await devSignIn(h, cfToken ?? undefined).catch(() => ({ error: "Network error. Please try again." }) as { error: string; recruit?: undefined; isNew?: undefined });
    signing.current = false;
    setBusy(false);
    if (res.error) {
      err();
      return print([`! ${res.error.toUpperCase()}`, "red"]);
    }
    if (res.recruit && res.isNew) reveal(res.recruit);
    else {
      print([`WELCOME BACK, @${h.toUpperCase()}.`, "amber"]);
      pointToTasks();
    }
  }

  async function mission(m: MissionId) {
    if (!recruit) return print(["ENLIST FIRST. ENTER YOUR X HANDLE.", "red"]);
    const def = MISSIONS.find((x) => x.id === m)!;
    if (m === "share") return share();
    window.open(MISSION_LINK[m], "_blank", "noopener");
    if (recruit.missions[m]) return print([`ORDER '${m}' ALREADY COMPLETE.`, "dim"]);
    const r = await call("/api/mission", { mission: m });
    if (r.error) return print([`! ${r.error}`, "red"]);
    beep(1320, 0.08, "triangle");
    print([`[OK] ${def.title.toUpperCase()} · +${def.xp} XP`, "green"]);
  }

  async function share() {
    if (!recruit) return print(["ENLIST FIRST.", "red"]);
    const s = getSoldier(recruit.soldierId);
    const rc = rarityClass(s.rank);
    const url = `${location.origin}/d/${recruit.handle}`;
    const text = `The Draft picked my soldier.\n\nSwoledier #${s.id} · ${rc.label} (rank ${s.rank}/${SUPPLY}) 💪\n\nYou don't pick yours. Report to the @${X_HANDLE} war room 👇`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
    if (!recruit.missions.share) {
      const r = await call("/api/mission", { mission: "share" });
      if (!r.error) print([`[OK] DOG TAGS POSTED · +${MISSIONS.find((m) => m.id === "share")!.xp} XP`, "green"]);
    }
  }

  async function card() {
    if (!recruit) return print(["ENLIST FIRST.", "red"]);
    const s = getSoldier(recruit.soldierId);
    const { renderCard } = await import("./card");
    const blob = await renderCard(recruit.handle, s, serialFor(recruit.handle, s.id));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `swoledier-${s.id}-${recruit.handle}.png`;
    a.click();
    print(["DRAFT CARD EXPORTED.", "green"]);
  }

  function status() {
    if (!recruit) return print(["NO SERVICE RECORD. ENTER YOUR X HANDLE TO ENLIST.", "red"]);
    const r = rankFor(recruit.xp);
    print(
      [`@${recruit.handle.toUpperCase()} · ${r.name} · ${recruit.xp} XP`, "amber"],
      ...RANKS.map((k, i) => [`  ${i <= r.index ? "[x]" : "[ ]"} ${k.name.padEnd(11)}${String(k.min).padStart(5)} XP${k.min === SECURED_AT ? "  < ALLOWLIST" : ""}`, i === r.index ? "amber" : i < r.index ? "green" : "dim"] as [string, Tone]),
      [recruit.xp >= SECURED_AT ? "ALLOWLIST: SECURED" : `ALLOWLIST: ${SECURED_AT - recruit.xp} XP TO SECURE`, recruit.xp >= SECURED_AT ? "green" : "ink"],
      [`WALLET: ${recruit.hasWallet ? "ON FILE" : "MISSING · wallet <address>"}`, recruit.hasWallet ? "green" : "red"],
    );
  }

  function orders() {
    if (!recruit) return print(["ENLIST FIRST. ENTER YOUR X HANDLE.", "red"]);
    print(
      ["ACTIVE ORDERS", "amber"],
      ...MISSIONS.map((m) => [`  [${recruit.missions[m.id] ? "x" : " "}] ${m.id.padEnd(8)} +${String(m.xp).padEnd(5)} ${m.title}`, recruit.missions[m.id] ? "dim" : "ink"] as [string, Tone]),
      [`  [${recruit.drillBest ? "x" : " "}] drill    +${XP.drillPerPoint}/kill Infection sweep`, "ink"],
      [`  [${recruit.hasWallet ? "x" : " "}] wallet   +${String(XP.wallet).padEnd(5)} Mint wallet`, recruit.hasWallet ? "dim" : "ink"],
      [`  [+] recruit  +${XP.perReferral}  per soldier (${recruit.referrals} so far)`, "ink"],
      ["TYPE AN ORDER'S NAME OR TAP IT IN THE ORDERS TAB.", "dim"],
    );
  }

  function recruitLink() {
    if (!recruit) return print(["ENLIST FIRST.", "red"]);
    const link = `${location.origin}/?ref=${recruit.handle}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    print(["RECRUITMENT LINK COPIED:", "green"], [link, "amber"], [`+${XP.perReferral} XP FOR EVERY SOLDIER DRAFTED THROUGH IT.`, "dim"]);
    toast("Recruit link copied");
  }

  async function wallet(addr: string) {
    if (!recruit) return print(["ENLIST FIRST.", "red"]);
    if (!addr) return print(["USAGE: wallet 0xYourAddress  (EVM or Solana)", "dim"], ["NEVER PASTE A SEED PHRASE. PUBLIC ADDRESS ONLY.", "red"]);
    const r = await call("/api/wallet", { wallet: addr });
    if (r.error) {
      err();
      return print([`! ${r.error.toUpperCase()}`, "red"]);
    }
    beep(1320, 0.08, "triangle");
    print([`[OK] WALLET LOCKED IN: ${addr.slice(0, 6)}…${addr.slice(-4)}`, "green"]);
  }

  function board() {
    if (!intel?.top.length) return print(["CHAIN OF COMMAND IS EMPTY. BE THE FIRST.", "dim"]);
    print(["CHAIN OF COMMAND", "amber"], ...intel.top.map((r, i) => [`  ${pad(i + 1, 2)} @${r.handle.padEnd(16)}${String(r.xp).padStart(5)} ${rankFor(r.xp).name}`, i < 3 ? "amber" : "ink"] as [string, Tone]));
  }

  async function drillStart() {
    if (recruit) await call("/api/drill/start");
  }

  async function drillDone(score: number) {
    if (!recruit) return print([`SWEEP: ${score} KILLS. SIGN IN TO BANK YOUR SCORE AS XP.`, "amber"]);
    if (score > recruit.drillBest) {
      const r = await call("/api/drill", { score });
      if (r.error) return print([`! ${r.error.toUpperCase()}`, "red"]);
      print([`[OK] NEW BEST SWEEP: ${score} KILLS · ${Math.min(score * XP.drillPerPoint, XP.drillMax)} XP BANKED`, "green"]);
    } else print([`SWEEP: ${score} KILLS. BEST STAYS ${recruit.drillBest}.`, "dim"]);
  }

  async function run(raw: string) {
    const text = raw.trim();
    if (!text) return;
    history.current.unshift(text);
    histIdx.current = -1;
    print([`${recruit ? "$" : "HANDLE>"} ${text}`, "echo"]);
    if (!recruit && !/^(help|board|inspect|drill|sound|clear|login)\b/i.test(text)) {
      if (auth?.mode === "handle") return devDraft(text);
      return print(["SIGN IN WITH X TO GET DRAFTED. TYPE 'login' OR USE THE BUTTON.", "amber"]);
    }
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");
    switch (cmd.toLowerCase()) {
      case "help":
        return print(
          ["COMMANDS", "amber"],
          ["  status        rank, XP, allowlist standing", "ink"],
          ["  orders        your task list", "ink"],
          ["  follow | repost | notify | share   run an order", "ink"],
          ["  drill         infection sweep minigame", "ink"],
          ["  recruit       copy your recruitment link", "ink"],
          ["  wallet <addr> submit mint wallet", "ink"],
          ["  card          download your draft card", "ink"],
          ["  board         chain of command", "ink"],
          ["  inspect <no>  pull any personnel file (1–4444)", "ink"],
          ["  sound         toggle console audio", "ink"],
          ["  login | logout | clear", "ink"],
        );
      case "status": return status();
      case "orders": return orders();
      case "follow": case "repost": case "notify": case "share": return mission(cmd.toLowerCase() as MissionId);
      case "drill": return setDrill(true);
      case "recruit": case "ref": return recruitLink();
      case "wallet": return wallet(arg);
      case "card": return card();
      case "board": return board();
      case "sound": return toggleSound();
      case "inspect": {
        const n = parseInt(arg, 10);
        if (!(n >= 1 && n <= SUPPLY)) return print([`USAGE: inspect <1–${SUPPLY}>`, "dim"]);
        const s = getSoldier(n);
        print([`PULLING FILE NO. ${pad(n)} · ${rarityClass(s.rank).label} · RANK ${s.rank}/${SUPPLY}`, "green"], ...CATEGORIES.map((c) => [`  ${c.toUpperCase().padEnd(11)}${s.traits[c]}`, "dim"] as [string, Tone]));
        return setFocus({ id: n });
      }
      case "login": return recruit ? print(["ALREADY SIGNED IN.", "dim"]) : startSignIn();
      case "clear": return setLines([]);
      case "logout":
        await signOut();
        setFocus(null);
        return print(["SIGNED OUT.", "dim"]);
      default:
        err();
        return print([`UNKNOWN COMMAND '${cmd}'. TYPE 'help'.`, "red"]);
    }
  }

  function toggleSound() {
    const v = !soundOn();
    setSound(v);
    setSnd(v);
    if (v) chord();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      histIdx.current = Math.max(-1, Math.min(h.length - 1, histIdx.current + (e.key === "ArrowUp" ? 1 : -1)));
      setInput(histIdx.current < 0 ? "" : h[histIdx.current]);
    }
  }

  const exec = (c: string) => {
    if (busy) return;
    run(c);
    inputRef.current?.focus({ preventScroll: true });
  };

  const onQuick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const c = e.currentTarget.dataset.cmd!;
    if (c === "wallet") {
      setInput("wallet ");
      inputRef.current?.focus();
    } else exec(c);
  };

  const me = recruit ?? null;
  const rank = me ? rankFor(me.xp) : null;
  const blips: Blip[] = intel?.blips ?? [];
  const mySoldier = me ? getSoldier(me.soldierId) : null;
  const doneFlags = me ? [...MISSIONS.map((m) => !!me.missions[m.id]), !!me.drillBest, me.hasWallet] : [];
  const total = MISSIONS.length + 2;
  const done = doneFlags.filter(Boolean).length;
  const left = me ? total - done : 0;

  const rarity = mySoldier ? rarityClass(mySoldier.rank) : null;
  const pctToNext = me && rank ? (rank.next ? ((me.xp - rank.min) / (rank.next.min - rank.min)) * 100 : 100) : 0;

  return (
    <div className="warroom" onClick={(e) => {
      if ((e.target as HTMLElement).closest("button,a,input,canvas,.panel-scroll")) return;
      inputRef.current?.focus({ preventScroll: true });
    }}>
      {/* top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand.gif" alt="" width={36} height={36} className="px" />
          </span>
          <span className="brand-name">Swolediers</span>
          <span className="brand-sub">War Room</span>
        </div>
        <div className="tb-stats hide-sm">
          <span className="live"><i className="dot" />Live</span>
          <span><b>{intel ? intel.count.toLocaleString() : "0"}</b> enlisted</span>
        </div>
        {me && rank && (
          <button className="xp-meter" onClick={() => { setTab("tasks"); sideRef.current?.scrollIntoView({ behavior: "smooth" }); }} title="Open your tasks">
            <LuZap className="xp-ico" aria-hidden />
            <span className="xp-num"><b key={me.xp}>{me.xp.toLocaleString()}</b> XP</span>
            <span className="xp-rank">
              <span>{rank.name}</span>
              <span className="xp-mini"><i style={{ width: `${pctToNext}%` }} /></span>
            </span>
            {gain && <span className="xp-pop" key={gain.k}><LuZap aria-hidden /> +{gain.n} XP</span>}
          </button>
        )}
        <div className="tb-actions">
          <button className="icon-btn" onClick={toggleSound} aria-pressed={snd} aria-label={snd ? "Turn sound off" : "Turn sound on"} title={snd ? "Sound on" : "Sound off"}>
            {snd ? <LuVolume2 /> : <LuVolumeX />}
          </button>
          <a className="icon-btn" href={X_PROFILE} target="_blank" rel="noopener" aria-label={`@${X_HANDLE} on X`} title={`@${X_HANDLE} on X`}>
            <FaXTwitter />
          </a>
        </div>
      </header>

      {/* terminal */}
      <section className="pane terminal">
        <div className="pane-head">
          <span className="ph-title"><LuTerminal aria-hidden />Terminal</span>
          <span className="ph-sub">{me ? "Type or tap a command" : auth?.mode === "handle" ? "Enter your handle to get drafted" : "Sign in to get drafted"}</span>
        </div>
        <div className="log panel-scroll" ref={logRef} aria-live="polite">
          {lines.map((l) => (
            <div key={l.id} className={`ln ${l.tone}`}>{l.text || " "}</div>
          ))}
        </div>
        <form className="prompt" onSubmit={(e) => { e.preventDefault(); if (!busy) { run(input); setInput(""); } }}>
          <LuChevronRight className="ps1" aria-hidden />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={me ? "Type a command, or 'help'" : auth?.mode === "handle" ? "Your X handle" : "Type 'login' or 'help'"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Command"
            disabled={busy}
          />
          <button className="btn btn-sm btn-primary" disabled={busy || !input.trim()}>Run</button>
        </form>
        <div className="quick">
          {(me ? ["status", "orders", "share", "recruit", "drill", "card", "help"] : ["login", "help", "board", "drill"]).map((c) => {
            const Icon = QUICK_ICON[c];
            return (
              <button key={c} className="btn btn-sm btn-ghost" data-cmd={c} onClick={onQuick}>
                {Icon && <Icon aria-hidden />}{QUICK[c]}
              </button>
            );
          })}
        </div>
      </section>

      {/* radar */}
      <section className="pane radar-pane">
        <div className="pane-head">
          <span className="ph-title"><LuRadar aria-hidden />Live radar</span>
          <span className="legend">
            <span className="lg-you"><LuUserRound aria-hidden />You</span>
            <span className="lg-al"><LuShieldCheck aria-hidden />Allowlisted</span>
            <span className="lg-rc"><LuCrosshair aria-hidden />Recruit</span>
          </span>
        </div>
        <div className="radar-stage">
          <Radar blips={blips} me={me?.handle} />
          {ready && !me && !focus && (
            <form className="welcome" onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              if (auth?.mode === "handle") {
                if (handleIn.trim()) devDraft(handleIn);
              } else startSignIn();
            }}>
              <span className="eyebrow"><i className="dot" />The Draft is open</span>
              <h1>Get your soldier</h1>
              <p>{auth?.mode === "handle" ? "Enter your X handle" : "Sign in with X"} and the Draft assigns you one of {SUPPLY.toLocaleString()} Swolediers. It&apos;s yours for good. No rerolls.</p>
              {auth?.mode === "handle" ? (
                <>
                  <label className="field">
                    <span className="field-pre">@</span>
                    <input value={handleIn} onChange={(e) => setHandleIn(e.target.value)} placeholder="yourhandle" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Your X handle" maxLength={16} />
                  </label>
                  {auth.turnstileSiteKey && <Turnstile siteKey={auth.turnstileSiteKey} onToken={setCfToken} />}
                  <button className="btn btn-primary btn-lg" disabled={busy || !handleIn.trim() || (!!auth.turnstileSiteKey && !cfToken)}>Draft me <LuArrowRight aria-hidden /></button>
                  <p className="fine"><LuLock aria-hidden /> Use your real X handle. Your soldier is tied to it.</p>
                </>
              ) : (
                <>
                  {auth?.turnstileSiteKey && <Turnstile siteKey={auth.turnstileSiteKey} onToken={setCfToken} />}
                  <button className="btn btn-x btn-lg" disabled={busy || (!!auth?.turnstileSiteKey && !cfToken)}>
                    <FaXTwitter aria-hidden /> Sign in with X
                  </button>
                  <p className="fine"><LuLock aria-hidden /> We only read your public profile. We never post for you.</p>
                </>
              )}
              <ol className="steps">
                <li><span><LuTarget aria-hidden /></span>Get drafted</li>
                <li><span><LuListChecks aria-hidden /></span>Complete tasks for XP</li>
                <li><span><LuShieldCheck aria-hidden /></span>Reach Lieutenant to secure the allowlist</li>
              </ol>
            </form>
          )}
          {focus && (
            <div className="file-card" key={focus.id + (focus.handle ?? "")}>
              <div className="file-head">
                <span>Personnel file #{focus.id}</span>
                <button className="icon-btn sm" onClick={() => setFocus(null)} aria-label="Close file"><LuX /></button>
              </div>
              <Decode id={focus.id} />
              <div className="file-foot">
                <span className={`pill tone-${rarityClass(getSoldier(focus.id).rank).tone}`}>{rarityClass(getSoldier(focus.id).rank).label}</span>
                <span>Rank {getSoldier(focus.id).rank} of {SUPPLY.toLocaleString()}</span>
                {focus.handle && <span className="handle">@{focus.handle}</span>}
              </div>
            </div>
          )}
        </div>
      </section>

      {coach && (
        <>
          <button className="coach" onClick={() => setCoach(false)}>
            <LuSparkles aria-hidden />
            <span><b>Start here.</b> Complete tasks to earn XP</span>
            <LuArrowRight aria-hidden />
          </button>
          <button className="coach-mobile" onClick={() => { setCoach(false); sideRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
            See your tasks <LuArrowDown aria-hidden />
          </button>
        </>
      )}

      {/* right column */}
      <aside ref={sideRef} className={`pane side ${coach ? "spotlight" : ""}`}>
        <div className="tabs" role="tablist">
          {([["you", "You", LuUserRound], ["tasks", "Tasks", LuListChecks], ["board", "Leaderboard", LuTrophy]] as const).map(([t, label, Icon]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); if (t === "tasks") setCoach(false); }}>
              <Icon aria-hidden />{label}
              {t === "tasks" && me && left > 0 && <span className="badge">{left}</span>}
            </button>
          ))}
        </div>
        <div className="panel-scroll side-body">
          {tab === "you" && (me && mySoldier && rank && rarity ? (
            <div className="stack">
              <div className="profile">
                <button className="avatar" onClick={() => setFocus({ id: me.soldierId, handle: me.handle })} aria-label="Open your soldier's file">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gifSrc(me.soldierId)} alt={`Your soldier, Swoledier ${me.soldierId}`} className="px" />
                </button>
                <div className="profile-id">
                  <b>@{me.handle}</b>
                  <span className="muted">Swoledier #{me.soldierId}</span>
                  <span className={`pill tone-${rarity.tone}`}>{rarity.label} · {mySoldier.rank} of {SUPPLY.toLocaleString()}</span>
                </div>
              </div>

              <div className="card">
                <div className="row"><span className="muted">Rank</span><b className="rank-name">{rank.name}</b></div>
                <div className="xpbar"><i style={{ width: `${pctToNext}%` }} /></div>
                <div className="row small"><span>{me.xp.toLocaleString()} XP</span><span>{rank.next ? `${(rank.next.min - me.xp).toLocaleString()} XP to ${rank.next.name}` : "Max rank"}</span></div>
              </div>

              <div className={`notice ${me.xp >= SECURED_AT ? "ok" : ""}`}>
                {me.xp >= SECURED_AT ? <LuShieldCheck aria-hidden /> : <LuLock aria-hidden />}
                {me.xp >= SECURED_AT ? "Allowlist secured" : `Allowlist unlocks at Lieutenant. ${(SECURED_AT - me.xp).toLocaleString()} XP to go.`}
              </div>

              {(() => {
                const n = nextStep(me);
                const Icon = TASK_ICON[n.cmd] ?? LuTarget;
                return (
                  <button className="next" data-cmd={n.cmd} onClick={onQuick}>
                    <span className="next-ico"><Icon aria-hidden /></span>
                    <span className="next-body">
                      <span className="eyebrow">Next step</span>
                      <b>{n.title}</b>
                    </span>
                    <span className="next-xp">{n.xp} XP <LuArrowRight aria-hidden /></span>
                  </button>
                );
              })()}

              <dl className="stats">
                <div><dt><LuWallet aria-hidden />Wallet</dt><dd className={me.hasWallet ? "ok" : "warn"}>{me.hasWallet ? "On file" : "Missing"}</dd></div>
                <div><dt><LuUsers aria-hidden />Friends invited</dt><dd>{me.referrals}</dd></div>
                <div><dt><LuBiohazard aria-hidden />Best sweep</dt><dd>{me.drillBest} kills</dd></div>
              </dl>

              <button className="btn btn-sm btn-ghost signout" data-cmd="logout" onClick={onQuick}><LuLogOut aria-hidden />Sign out</button>
            </div>
          ) : (
            <div className="stack">
              <span className="eyebrow">How it works</span>
              <ol className="how">
                <li><span><FaXTwitter aria-hidden /></span><div><b>{auth?.mode === "handle" ? "Enter your X handle" : "Sign in with X"}</b><p>Your handle is your enlistment.</p></div></li>
                <li><span><LuTarget aria-hidden /></span><div><b>Get drafted</b><p>The Draft assigns one of {SUPPLY.toLocaleString()} soldiers to you. No rerolls.</p></div></li>
                <li><span><LuZap aria-hidden /></span><div><b>Earn XP</b><p>Complete tasks, play Infection Sweep and invite friends.</p></div></li>
                <li><span><LuShieldCheck aria-hidden /></span><div><b>Secure your spot</b><p>Reach Lieutenant ({SECURED_AT.toLocaleString()} XP) to lock in the allowlist.</p></div></li>
              </ol>
              <a className="fine-link" href="/privacy">Privacy and cookies</a>
            </div>
          ))}

          {tab === "tasks" && (
            <div className="stack tight">
              {me && rank && (
                <div className="card summary">
                  <div className="row">
                    <span className="big-xp"><b>{me.xp.toLocaleString()}</b> XP</span>
                    <span className="rank-name">{rank.name}</span>
                  </div>
                  <div className="xpbar"><i style={{ width: `${Math.min(100, (me.xp / SECURED_AT) * 100)}%` }} /></div>
                  <div className="row small">
                    <span>{me.xp >= SECURED_AT ? "Allowlist secured" : `${(SECURED_AT - me.xp).toLocaleString()} XP to allowlist`}</span>
                    <span>{done} of {total} done</span>
                  </div>
                </div>
              )}
              {MISSIONS.map((m) => (
                <Task key={m.id} icon={TASK_ICON[m.id]} title={m.title} sub={m.brief} done={!!me?.missions[m.id]} reward={`+${m.xp} XP`} cta="Go" data-cmd={m.id} onClick={onQuick} />
              ))}
              <Task icon={LuBiohazard} title="Infection Sweep" sub={`Best ${me?.drillBest ?? 0} kills · ${XP.drillPerPoint} XP per kill`} done={!!me?.drillBest} doneLabel="Replay" reward={`Up to ${XP.drillMax}`} cta="Play" data-cmd="drill" onClick={onQuick} />
              <Task icon={LuWallet} title="Mint wallet" sub="EVM or Solana public address" done={!!me?.hasWallet} reward={`+${XP.wallet} XP`} cta="Add" data-cmd="wallet" onClick={onQuick} />
              <Task icon={LuUsers} title="Invite friends" sub={me ? `${me.referrals} joined through your link` : "Copy your invite link"} reward={`+${XP.perReferral} each`} cta="Copy" data-cmd="recruit" onClick={onQuick} />
              {!me && <p className="muted fine">Sign in with X to unlock tasks.</p>}
            </div>
          )}

          {tab === "board" && (
            <div className="stack">
              {intel?.top.length ? (
                <ol className="leaders">
                  {intel.top.map((r, i) => (
                    <li key={r.handle} className={r.handle === me?.handle ? "me" : ""}>
                      <span className={`place p${i + 1}`}>{i < 3 ? <LuMedal aria-hidden /> : i + 1}</span>
                      <span className="who">@{r.handle}</span>
                      <span className="lr">{rankFor(r.xp).name}</span>
                      <span className="lx">{r.xp.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="muted">No one on the board yet. The first recruit takes the top spot.</p>}
              <span className="eyebrow">Ranks</span>
              <ol className="ladder">
                {RANKS.map((k) => (
                  <li key={k.name} className={me && rank && k.name === rank.name ? "cur" : ""}>
                    <span className="who">{k.name}</span>
                    <span className="lr">{k.perk}</span>
                    <span className="lx">{k.min.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </aside>

      {/* feed */}
      <footer className="feed">
        <div className="feed-track">
          {[0, 1].map((dup) => (
            <span key={dup} className="feed-set">
              {(intel?.recent.length ? intel.recent : []).map((r) => (
                <span key={r.handle + dup}>
                  <LuUserPlus aria-hidden />@{r.handle} drafted #{r.soldierId}
                  <em className={`tone-${rarityClass(getSoldier(r.soldierId).rank).tone}`}>{rarityClass(getSoldier(r.soldierId).rank).label}</em>
                </span>
              ))}
              <span><LuRadar aria-hidden />The Draft is open</span>
              <span><LuTarget aria-hidden />One handle, one soldier, no rerolls</span>
              <span><LuBiohazard aria-hidden />Infection detected in the ranks</span>
            </span>
          ))}
        </div>
      </footer>

      {drill && <Drill best={me?.drillBest} onStart={drillStart} onFinish={drillDone} onClose={() => setDrill(false)} />}
    </div>
  );
}

function Task({ icon: Icon, title, sub, done, doneLabel = "Done", reward, cta, ...rest }: {
  icon: IconType; title: string; sub: string; done?: boolean; doneLabel?: string; reward: string; cta: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> & { "data-cmd": string }) {
  return (
    <button className={`task ${done ? "done" : ""}`} {...rest}>
      <span className="task-ico">{done ? <LuCheck aria-hidden /> : <Icon aria-hidden />}</span>
      <span className="task-body"><b>{title}</b><small>{sub}</small></span>
      <span className="task-end">
        {done ? <span className="task-done">{doneLabel}</span> : (
          <>
            <span className="task-xp">{reward}</span>
            <span className="task-cta">{cta}<LuArrowUpRight aria-hidden /></span>
          </>
        )}
      </span>
    </button>
  );
}
