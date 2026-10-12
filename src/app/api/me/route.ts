import { authMode, getSession } from "@/lib/auth";
import { getRecruit } from "@/lib/store";
import { toPublic } from "@/lib/game";

export async function GET() {
  const s = await getSession();
  const recruit = s ? await getRecruit(s.h) : null;
  return Response.json({
    recruit: recruit ? toPublic(recruit) : null,
    auth: { mode: authMode, turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null },
  });
}
