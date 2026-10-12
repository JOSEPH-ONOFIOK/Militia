import { getSession } from "./auth";
import { getRecruit, store } from "./store";

export const bad = (error: string, status = 400) => Response.json({ error }, { status });

// Reads the session cookie and JSON body, and applies a per-recruit rate limit.
export async function authed(req: Request) {
  const s = await getSession();
  if (!s) return { error: bad("Please sign in first.", 401) };
  const recruit = await getRecruit(s.h);
  if (!recruit) return { error: bad("Account not found. Please sign in again.", 401) };
  if (!(await store.limit(`act:${s.h}`, 40, 60))) return { error: bad("Slow down, soldier. Try again in a minute.", 429) };
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return { recruit, body };
}
