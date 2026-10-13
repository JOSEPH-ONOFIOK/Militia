import { connection } from "next/server";
import { authMode, getSession } from "@/lib/auth";
import { getRecruit, storageMode } from "@/lib/store";
import { toPublic } from "@/lib/game";

export async function GET() {
  // Always answer at request time: the sign in mode and storage come from runtime settings
  await connection();
  const s = storageMode === "server" ? await getSession() : null;
  const recruit = s ? await getRecruit(s.h) : null;
  return Response.json({
    recruit: recruit ? toPublic(recruit) : null,
    auth: { mode: authMode, storage: storageMode, turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null },
  });
}
