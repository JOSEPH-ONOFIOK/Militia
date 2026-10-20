import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { MISSIONS, computeXp, rankFor, type Recruit } from "./game";
import { FACTIONS, factionOf } from "./factions";

// Storage, first one configured wins:
//   Upstash Redis   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   Google Sheets   GOOGLE_SHEETS_WEBAPP_URL (Apps Script web app, see scripts/apps-script)
//   JSON file       .data/ for local development

type Row = { recruit: Recruit };

interface Store {
  get(handle: string): Promise<Row | null>;
  put(row: Row, isNew: boolean): Promise<void>;
  top(n: number): Promise<Recruit[]>;
  recent(n: number): Promise<Recruit[]>;
  count(): Promise<number>;
  all(): Promise<Recruit[]>;
  ranked(n: number): Promise<{ handle: string; xp: number }[]>;
  handleForXid(xid: string): Promise<string | null>;
  linkXid(xid: string, handle: string): Promise<void>;
  // Adds one invite to a recruit atomically, so simultaneous sign ups all count.
  addReferral(handle: string): Promise<void>;
  // Fixed-window rate limit. Returns true when the call is allowed.
  limit(key: string, max: number, windowSec: number): Promise<boolean>;
}

// ---------- Upstash ----------
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

const upstash: Store = {
  async get(handle) {
    const v = await redis<string | null>("GET", `r:${handle}`);
    return v ? (JSON.parse(v) as Row) : null;
  },
  async put(row, isNew) {
    const h = row.recruit.handle;
    await redis("SET", `r:${h}`, JSON.stringify(row));
    await redis("ZADD", "lb", computeXp(row.recruit), h);
    if (isNew) {
      await redis("LPUSH", "recent", h);
      await redis("LTRIM", "recent", 0, 49);
    }
  },
  async top(n) {
    const handles = await redis<string[]>("ZRANGE", "lb", 0, n - 1, "REV");
    return loadMany(handles);
  },
  async recent(n) {
    return loadMany(await redis<string[]>("LRANGE", "recent", 0, n - 1));
  },
  count: () => redis<number>("ZCARD", "lb"),
  async all() {
    const handles = await redis<string[]>("ZRANGE", "lb", 0, -1, "REV");
    return loadMany(handles);
  },
  handleForXid: (xid) => redis<string | null>("GET", `xid:${xid}`),
  async addReferral(handle) {
    const row = await this.get(handle);
    if (!row) return;
    row.recruit.referrals += 1;
    await this.put(row, false);
  },
  async linkXid(xid, handle) {
    await redis("SET", `xid:${xid}`, handle);
  },
  async limit(key, max, windowSec) {
    const n = await redis<number>("INCR", `rl:${key}`);
    if (n === 1) await redis("EXPIRE", `rl:${key}`, windowSec);
    return n <= max;
  },
  async ranked(n) {
    const flat = await redis<string[]>("ZRANGE", "lb", 0, n - 1, "REV", "WITHSCORES");
    const out: { handle: string; xp: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ handle: flat[i], xp: Number(flat[i + 1]) });
    return out;
  },
};

async function loadMany(handles: string[]) {
  if (!handles.length) return [];
  const vals = await redis<(string | null)[]>("MGET", ...handles.map((h) => `r:${h}`));
  return vals.filter(Boolean).map((v) => (JSON.parse(v!) as Row).recruit);
}

// ---------- Local file ----------
// For local development only. Reads the file fresh on every call: Next.js loads each
// route as its own bundle, so an in-memory copy would go stale between routes.
const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "recruits.json");
const windows = new Map<string, { n: number; reset: number }>();
let queue: Promise<unknown> = Promise.resolve();

async function db(): Promise<Record<string, Row>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

// Read, change and write back as one step. A failed write never leaves a ghost record behind.
function mutate(fn: (d: Record<string, Row>) => void) {
  const run = queue.then(async () => {
    const d = await db();
    fn(d);
    await mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(d));
    await rename(tmp, FILE);
  });
  queue = run.catch(() => {}); // keep the queue alive after a failure
  return run;
}

const file: Store = {
  async get(handle) {
    return (await db())[handle] ?? null;
  },
  async put(row) {
    await mutate((d) => {
      d[row.recruit.handle] = row;
    });
  },
  async top(n) {
    return (await this.all()).slice(0, n);
  },
  async recent(n) {
    return Object.values(await db())
      .map((r) => r.recruit)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, n);
  },
  async count() {
    return Object.keys(await db()).length;
  },
  async all() {
    return Object.values(await db())
      .map((r) => r.recruit)
      .sort((a, b) => computeXp(b) - computeXp(a));
  },
  async handleForXid(xid) {
    return Object.values(await db()).find((r) => r.recruit.xid === xid)?.recruit.handle ?? null;
  },
  async linkXid() {
    // the file store finds handles by scanning recruit.xid
  },
  async addReferral(handle) {
    await mutate((d) => {
      if (d[handle]) d[handle].recruit.referrals += 1;
    });
  },
  async limit(key, max, windowSec) {
    const now = Date.now();
    const w = windows.get(key);
    if (!w || w.reset < now) {
      windows.set(key, { n: 1, reset: now + windowSec * 1000 });
      return true;
    }
    return ++w.n <= max;
  },
  async ranked(n) {
    return (await this.all()).slice(0, n).map((r) => ({ handle: r.handle, xp: computeXp(r) }));
  },
};

// ---------- Google Sheets (Apps Script web app) ----------
const SHEETS_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL;
const SHEETS_SECRET = process.env.SHEETS_WEBHOOK_SECRET;
const LIST_TTL = 20_000; // the full list is cached per server instance to spare Apps Script quota
let listCache: { at: number; recruits: Recruit[] } | null = null;
let listLoading: Promise<Recruit[]> | null = null;

async function sheetGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(SHEETS_URL!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (SHEETS_SECRET) url.searchParams.set("secret", SHEETS_SECRET);
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sheets web app returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Sheets web app: ${data.error}`);
  return data as T;
}

async function sheetPost<T>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(SHEETS_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, secret: SHEETS_SECRET }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Sheets web app returned ${res.status}`);
    const data = await res.json();
    // "busy" means the script lock was held for 20s; worth a couple of retries
    if (data.error === "busy" && attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 + attempt * 800));
      continue;
    }
    return data;
  }
}

// Human readable columns written next to the raw record
function display(r: Recruit) {
  const xp = computeXp(r);
  return {
    xp,
    rank: rankFor(xp).name,
    faction: FACTIONS[factionOf(r.soldierId)].name,
    soldier: `Militia #${r.soldierId}`,
    tasksDone: MISSIONS.filter((m) => r.missions[m.id]).length + (r.wallet ? 1 : 0),
  };
}

// When two saves race, keep the best of both: progress only ever moves forward.
function merge(mine: Recruit, theirs: Recruit): Recruit {
  const missions = { ...theirs.missions };
  for (const [k, v] of Object.entries(mine.missions)) {
    const key = k as keyof typeof missions;
    missions[key] = Math.min(v as number, (missions[key] as number) ?? Infinity);
  }
  return {
    ...theirs,
    ...mine,
    missions,
    referrals: Math.max(mine.referrals, theirs.referrals),
    wallet: mine.wallet ?? theirs.wallet,
    xid: theirs.xid ?? mine.xid,
    referredBy: theirs.referredBy ?? mine.referredBy,
    createdAt: Math.min(mine.createdAt, theirs.createdAt),
    rev: theirs.rev,
  };
}

function cacheRecruit(r: Recruit) {
  if (!listCache) return;
  const i = listCache.recruits.findIndex((x) => x.handle === r.handle);
  if (i >= 0) listCache.recruits[i] = r;
  else listCache.recruits.push(r);
}

async function sheetList(): Promise<Recruit[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.recruits;
  listLoading ??= sheetGet<{ recruits: Recruit[] }>({ list: "1" })
    .then((d) => {
      listCache = { at: Date.now(), recruits: d.recruits };
      return d.recruits;
    })
    .finally(() => {
      listLoading = null;
    });
  return listLoading;
}

const sortedByXp = (rs: Recruit[]) => [...rs].sort((a, b) => computeXp(b) - computeXp(a));

const sheets: Store = {
  async get(handle) {
    const d = await sheetGet<{ recruit: Recruit | null }>({ handle });
    return d.recruit ? { recruit: d.recruit } : null;
  },
  async put(row) {
    let r = row.recruit;
    for (let attempt = 0; attempt < 4; attempt++) {
      const d = await sheetPost<{ rev?: number; recruit?: Recruit }>({ action: "put", recruit: r, display: display(r), expectRev: r.rev ?? 0 });
      if (d.error === "conflict" && d.recruit) {
        r = merge(r, d.recruit);
        continue;
      }
      if (d.error) throw new Error(`Sheets web app: ${d.error}`);
      r.rev = d.rev;
      Object.assign(row.recruit, r);
      cacheRecruit(row.recruit);
      return;
    }
    throw new Error("Could not save: too many simultaneous changes. Please try again.");
  },
  async top(n) {
    return sortedByXp(await sheetList()).slice(0, n);
  },
  async recent(n) {
    return [...(await sheetList())].sort((a, b) => b.createdAt - a.createdAt).slice(0, n);
  },
  async count() {
    return (await sheetList()).length;
  },
  async all() {
    return sortedByXp(await sheetList());
  },
  async ranked(n) {
    return sortedByXp(await sheetList()).slice(0, n).map((r) => ({ handle: r.handle, xp: computeXp(r) }));
  },
  async handleForXid(xid) {
    return (await sheetGet<{ handle: string | null }>({ xid })).handle;
  },
  async linkXid() {
    // the X user id is stored on the recruit's row
  },
  async addReferral(handle) {
    const d = await sheetPost<{ recruit?: Recruit }>({ action: "referral", handle });
    if (d.error) throw new Error(`Sheets web app: ${d.error}`);
    if (d.recruit) {
      // refresh the XP and Rank columns, which the script can't compute
      await this.put({ recruit: d.recruit }, false);
    }
  },
  limit: (key, max, windowSec) => file.limit(key, max, windowSec),
};

// The file store can't work on serverless hosts (read only disk, many instances), so fail loudly there.
const serverless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const hasServerDb = !!(URL_ && TOKEN) || !!SHEETS_URL;
export const dbConfigured = hasServerDb || !serverless;
export class DbNotConfigured extends Error {}

const unconfigured = new Proxy({} as Store, {
  get() {
    return () => Promise.reject(new DbNotConfigured("Database not configured: set GOOGLE_SHEETS_WEBAPP_URL (or the Upstash variables)"));
  },
});

// "server": shared database (Upstash or Google Sheets). "local": no database yet, each visitor's progress lives in their browser.
export const storageMode: "server" | "local" = hasServerDb ? "server" : "local";

export const store: Store = URL_ && TOKEN ? upstash : SHEETS_URL ? sheets : serverless ? unconfigured : file;

export async function getRecruit(handle: string) {
  return (await store.get(handle))?.recruit ?? null;
}

export async function saveRecruit(recruit: Recruit, isNew = false) {
  await store.put({ recruit }, isNew);
}
