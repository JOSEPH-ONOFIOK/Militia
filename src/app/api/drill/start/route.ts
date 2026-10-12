import { cookies } from "next/headers";
import { DRILL_COOKIE, cookieBase, getSession, sign } from "@/lib/auth";
import { bad } from "@/lib/api";
import { store } from "@/lib/store";

// Starts a timed sweep. The finish call must come at least one full round later.
export async function POST() {
  const s = await getSession();
  if (!s) return bad("Please sign in first.", 401);
  if (!(await store.limit(`drill:${s.h}`, 6, 300))) return bad("Too many runs. Take a breather.", 429);
  (await cookies()).set({ name: DRILL_COOKIE, value: sign({ h: s.h, t: Date.now() }), ...cookieBase, path: "/api/drill", maxAge: 600 });
  return Response.json({ ok: true });
}
