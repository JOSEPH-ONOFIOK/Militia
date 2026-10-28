import { saveRecruit } from "@/lib/store";
import { authed, bad } from "@/lib/api";
import { checkProof, toPublic, type MissionId } from "@/lib/game";

export async function POST(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const mission = String(a.body.mission) as MissionId;
  const proof = checkProof(mission, a.body.proof);
  if (!proof.ok) return bad(proof.error);
  a.recruit.missions[mission] ??= Date.now();
  if (proof.value) a.recruit.proofs = { ...a.recruit.proofs, [mission]: proof.value };
  await saveRecruit(a.recruit);
  return Response.json({ recruit: toPublic(a.recruit) });
}
