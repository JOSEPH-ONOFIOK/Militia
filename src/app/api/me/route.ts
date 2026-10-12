import { authMode, getSession } from "@/lib/auth";
import { getRecruit, storageMode } from "@/lib/store";
import { toPublic } from "@/lib/game";

export async function GET() {
  const s = storageMode === "server" ? await getSession() : null;
  const recruit = s ? await getRecruit(s.h) : null;
  return Response.json({
    recruit: recruit ? toPublic(recruit) : null,
    auth: { mode: authMode, storage: storageMode, turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null },
  });
}
