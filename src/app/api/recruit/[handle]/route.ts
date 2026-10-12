import { store } from "@/lib/store";
import { bad } from "@/lib/api";
import { toPublic } from "@/lib/game";
import { normalizeHandle } from "@/lib/swole";

export async function GET(_req: Request, ctx: RouteContext<"/api/recruit/[handle]">) {
  const { handle } = await ctx.params;
  const row = await store.get(normalizeHandle(handle));
  if (!row) return bad("Not found", 404);
  return Response.json({ recruit: toPublic(row.recruit) });
}
