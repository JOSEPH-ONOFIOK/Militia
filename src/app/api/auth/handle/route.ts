import { authMode, clientIp, getSession, hasSecret, sessionCookie, verifyTurnstile } from "@/lib/auth";
import { bad } from "@/lib/api";
import { enroll } from "@/lib/enroll";
import { toPublic } from "@/lib/game";
import { getRecruit, store } from "@/lib/store";
import { isValidHandle, normalizeHandle } from "@/lib/swole";

// Temporary sign in by typing an X handle. Turns off automatically once X sign in is configured.
export async function POST(req: Request) {
  if (authMode !== "handle") return bad("Please use Sign in with X.", 404);
  if (!hasSecret) return bad("Sign in is not configured yet (missing SESSION_SECRET).", 503);

  const ip = clientIp(req);
  if (!(await store.limit(`handle:${ip}`, 10, 600))) return bad("Too many sign in attempts. Try again in a few minutes.", 429);

  const body = await req.json().catch(() => ({}));
  if (!(await verifyTurnstile(typeof body.cf === "string" ? body.cf : null, ip))) return bad("Security check failed. Please try again.", 400);

  const handle = normalizeHandle(String(body.handle ?? ""));
  if (!isValidHandle(handle)) return bad("That isn't a valid X handle.");

  // Without X verification, an enlisted handle can only be reopened from the device that enlisted it
  const existing = await getRecruit(handle);
  if (existing) {
    const s = await getSession();
    if (s?.h !== handle) return bad("This handle is already enlisted. Sign in from the device you enlisted on.", 409);
  }

  const { recruit, isNew } = await enroll({ handle, qualified: true, ref: body.ref });
  const res = Response.json({ recruit: toPublic(recruit), isNew });
  const c = sessionCookie(recruit.handle);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${c.name}=${c.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${c.maxAge}${secure}`);
  return res;
}
