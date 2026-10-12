import { cookies } from "next/headers";
import { saveRecruit } from "@/lib/store";
import { authed, bad } from "@/lib/api";
import { DRILL_COOKIE, unsign } from "@/lib/auth";
import { toPublic } from "@/lib/game";

const ROUND_MS = 30_000;
const MAX_KILLS = 60;

export async function POST(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const jar = await cookies();
  const run = unsign<{ h: string; t: number }>(jar.get(DRILL_COOKIE)?.value);
  jar.set({ name: DRILL_COOKIE, value: "", path: "/api/drill", maxAge: 0 });

  const elapsed = run ? Date.now() - run.t : 0;
  if (!run || run.h !== a.recruit.handle || elapsed < ROUND_MS - 1500 || elapsed > 600_000) {
    return bad("This sweep couldn't be verified. Start a new one.", 400);
  }
  const score = Math.max(0, Math.min(MAX_KILLS, Math.floor(Number(a.body.score) || 0)));
  a.recruit.drillBest = Math.max(a.recruit.drillBest, score);
  await saveRecruit(a.recruit);
  return Response.json({ recruit: toPublic(a.recruit) });
}
