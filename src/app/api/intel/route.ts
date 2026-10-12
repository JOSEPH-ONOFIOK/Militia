import { connection } from "next/server";
import { store } from "@/lib/store";
import { toPublic } from "@/lib/game";

export async function GET() {
  await connection();
  const [count, top, recent, blips] = await Promise.all([
    store.count(),
    store.top(10),
    store.recent(15),
    store.ranked(500),
  ]);
  return Response.json({
    count,
    top: top.map(toPublic),
    recent: recent.map((r) => ({ handle: r.handle, soldierId: r.soldierId })),
    blips,
  });
}
