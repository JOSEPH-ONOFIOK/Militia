import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_COOKIE, exchangeAndFetchUser, sessionCookie, siteOrigin, unsign, type OAuthState } from "@/lib/auth";
import { enroll, qualifies } from "@/lib/enroll";

// X redirects here after the user approves (or cancels) sign in
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(req);
  const jar = await cookies();
  const o = unsign<OAuthState>(jar.get(OAUTH_COOKIE)?.value);

  const done = (query: string) => {
    const res = NextResponse.redirect(`${origin}/?${query}`);
    res.cookies.set({ name: OAUTH_COOKIE, value: "", path: "/api/auth", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return done("auth_error=cancelled");
  const code = url.searchParams.get("code");
  if (!o || !code || url.searchParams.get("state") !== o.state || Date.now() - o.ts > 600_000) {
    return done("auth_error=expired");
  }

  try {
    const user = await exchangeAndFetchUser(code, o.verifier, `${origin}/api/auth/x/callback`);
    const { recruit, isNew } = await enroll({ handle: user.username, xid: user.id, qualified: qualifies(user), ref: o.ref });
    const res = done(isNew ? "drafted=1" : "welcome=1");
    res.cookies.set(sessionCookie(recruit.handle));
    return res;
  } catch (e) {
    const msg = e instanceof Error && e.message === "handle_taken" ? "handle_taken" : "x_failed";
    if (msg === "x_failed") console.error("X sign in failed", e);
    return done(`auth_error=${msg}`);
  }
}
