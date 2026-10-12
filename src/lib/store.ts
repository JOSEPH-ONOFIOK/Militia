import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { computeXp, type Recruit } from "./game";

// Storage: Upstash Redis (REST) when UPSTASH_REDIS_REST_URL/TOKEN are set,
// otherwise a JSON file in .data/ for local development.

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

// The file store can't work on serverless hosts (read only disk, many instances), so fail loudly there.
const serverless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const dbConfigured = !!(URL_ && TOKEN) || !serverless;
export class DbNotConfigured extends Error {}

const unconfigured = new Proxy({} as Store, {
  get() {
    return () => Promise.reject(new DbNotConfigured("Database not configured: add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"));
  },
});

export const store: Store = URL_ && TOKEN ? upstash : serverless ? unconfigured : file;

export async function getRecruit(handle: string) {
  return (await store.get(handle))?.recruit ?? null;
}

export async function saveRecruit(recruit: Recruit, isNew = false) {
  await store.put({ recruit }, isNew);
}
