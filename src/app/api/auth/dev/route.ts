import { authMode, sessionCookie } from "@/lib/auth";
import { bad } from "@/lib/api";
import { enroll } from "@/lib/enroll";
import { toPublic } from "@/lib/game";
import { isValidHandle, normalizeHandle } from "@/lib/swole";

// Local development only: sign in as any handle without X. Disabled when X sign in is configured or in production.
export async function POST(req: Request) {
  if (authMode !== "dev") return bad("Not available", 404);
  const body = await req.json().catch(() => ({}));
  const handle = normalizeHandle(String(body.handle ?? ""));
  if (!isValidHandle(handle)) return bad("That isn't a valid X handle.");
  const { recruit, isNew } = await enroll({ handle, qualified: true, ref: body.ref });
  const res = Response.json({ recruit: toPublic(recruit), isNew });
  const c = sessionCookie(recruit.handle);
  res.headers.append("Set-Cookie", `${c.name}=${c.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${c.maxAge}`);
  return res;
}
