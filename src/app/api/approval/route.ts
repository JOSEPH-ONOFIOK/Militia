import { authed, bad } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { APPROVAL_POST_ID, INTEL_WORD, maybeApprove, toPublic, type ApprovalStep } from "@/lib/game";
import { saveRecruit, store, storageMode } from "@/lib/store";
import { isValidHandle, normalizeHandle } from "@/lib/swole";
import { verifyReply } from "@/lib/xpost";

const STEPS: ApprovalStep[] = ["follow", "repost", "reply"];

// Pending → Approved: records the follow and repost taps, verifies the "$INTEL" reply,
// and approves the recruit once all three are in.
export async function POST(req: Request) {
  if (!APPROVAL_POST_ID) return bad("Approval isn't open yet.", 404);

  // Browser storage mode (no database): only verify the reply; the browser saves the result
  if (storageMode === "local") {
    const body = await req.json().catch(() => ({}));
    if (body.step !== "reply") return Response.json({ ok: true });
    const handle = normalizeHandle(String(body.handle ?? ""));
    if (!isValidHandle(handle)) return bad("Sign in first.", 401);
    if (!(await store.limit(`reply:${clientIp(req)}`, 15, 600))) return bad("Too many checks. Try again in a few minutes.", 429);
    const v = await verifyReply(String(body.link ?? ""), handle, APPROVAL_POST_ID, INTEL_WORD);
    return v.ok ? Response.json({ ok: true, link: v.link }) : bad(v.error);
  }

  const a = await authed(req);
  if ("error" in a) return a.error;
  const r = a.recruit;
  const step = String(a.body.step) as ApprovalStep;
  if (!STEPS.includes(step)) return bad("Unknown step");
  if (r.approval?.at) return Response.json({ recruit: toPublic(r) });

  if (step === "reply") {
    if (!(await store.limit(`reply:${r.handle}`, 15, 600))) return bad("Too many checks. Try again in a few minutes.", 429);
    const v = await verifyReply(String(a.body.link ?? ""), r.handle, APPROVAL_POST_ID, INTEL_WORD);
    if (!v.ok) return bad(v.error);
    r.approval = { ...r.approval, reply: v.link };
  } else {
    r.approval = { ...r.approval, [step]: r.approval?.[step] ?? Date.now() };
    if (step === "follow") r.missions.follow ??= Date.now(); // same action as the Follow step
  }
  maybeApprove(r);
  await saveRecruit(r);
  return Response.json({ recruit: toPublic(r) });
}
