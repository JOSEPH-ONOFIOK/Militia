import { NextResponse } from "next/server";
import { OAUTH_COOKIE, authMode, authorizeUrl, clientIp, cookieBase, newOAuth, sign, siteOrigin, verifyTurnstile } from "@/lib/auth";
import { store } from "@/lib/store";

// GET /api/auth/x/start?ref=handle&cf=turnstileToken → redirects to X
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const fail = (code: string) => NextResponse.redirect(`${origin}/?auth_error=${code}`);

  if (authMode !== "x") return fail("unavailable");
  const ip = clientIp(req);
  if (!(await store.limit(`start:${ip}`, 20, 600))) return fail("rate_limited");
  if (!(await verifyTurnstile(url.searchParams.get("cf"), ip))) return fail("bot_check");

  const o = newOAuth(url.searchParams.get("ref") || undefined);
  const res = NextResponse.redirect(authorizeUrl(o, `${origin}/api/auth/x/callback`));
  res.cookies.set({ name: OAUTH_COOKIE, value: sign(o), ...cookieBase, path: "/api/auth", maxAge: 600 });
  return res;
}
