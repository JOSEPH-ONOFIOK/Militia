import { saveRecruit } from "@/lib/store";
import { authed, bad } from "@/lib/api";
import { MISSIONS, toPublic, type MissionId } from "@/lib/game";

export async function POST(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const mission = String(a.body.mission) as MissionId;
  if (!MISSIONS.some((m) => m.id === mission)) return bad("Unknown mission");
  a.recruit.missions[mission] ??= Date.now();
  await saveRecruit(a.recruit);
  return Response.json({ recruit: toPublic(a.recruit) });
}
