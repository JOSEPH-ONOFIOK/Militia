import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// ---------- config ----------
export const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret");
export const hasSecret = !!SECRET;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

// "x": Sign in with X (set X_CLIENT_ID + SESSION_SECRET). "handle": temporary mode where recruits type their handle.
export type AuthMode = "x" | "handle";
// X sign in also needs the shared database, since accounts are stored server side
export const authMode: AuthMode = X_CLIENT_ID && SECRET && (process.env.UPSTASH_REDIS_REST_URL || process.env.GOOGLE_SHEETS_WEBAPP_URL) ? "x" : "handle";

export const SESSION_COOKIE = "swole_session";
export const OAUTH_COOKIE = "swole_oauth";
export const DRILL_COOKIE = "swole_drill";
const secure = process.env.NODE_ENV === "production";
export const cookieBase = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

// ---------- signed values: base64url(json).hmac ----------
export function sign(data: object) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign<T>(value: string | undefined): T | null {
  if (!value || !SECRET) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", SECRET).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// ---------- session ----------
export type Session = { h: string; iat: number };
const SESSION_DAYS = 30;

export async function getSession() {
  const s = unsign<Session>((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s || Date.now() - s.iat > SESSION_DAYS * 864e5) return null;
  return s;
}

export function sessionCookie(handle: string) {
  return {
    name: SESSION_COOKIE,
    value: sign({ h: handle, iat: Date.now() } satisfies Session),
    ...cookieBase,
    maxAge: SESSION_DAYS * 86400,
  };
}

// ---------- X OAuth 2.0 (PKCE) ----------
export type OAuthState = { state: string; verifier: string; ref?: string; ts: number };

export function newOAuth(ref?: string): OAuthState {
  return { state: randomBytes(16).toString("base64url"), verifier: randomBytes(32).toString("base64url"), ref, ts: Date.now() };
}

export function authorizeUrl(o: OAuthState, redirectUri: string) {
  const challenge = createHash("sha256").update(o.verifier).digest("base64url");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: X_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "users.read tweet.read",
    state: o.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://x.com/i/oauth2/authorize?${q}`;
}

export type XUser = { id: string; username: string; created_at?: string; public_metrics?: { followers_count: number } };

export async function exchangeAndFetchUser(code: string, verifier: string, redirectUri: string): Promise<XUser> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (X_CLIENT_SECRET) headers.Authorization = `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64")}`;
  const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier, client_id: X_CLIENT_ID! }),
    cache: "no-store",
  });
  if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const meRes = await fetch("https://api.x.com/2/users/me?user.fields=created_at,public_metrics", {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });
  if (!meRes.ok) throw new Error(`users/me ${meRes.status}`);
  return (await meRes.json()).data as XUser;
}

// ---------- Cloudflare Turnstile ----------
export const turnstileOn = !!TURNSTILE_SECRET;

export async function verifyTurnstile(token: string | null, ip: string) {
  if (!TURNSTILE_SECRET) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    cache: "no-store",
  });
  return !!(await res.json()).success;
}

// ---------- request helpers ----------
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function siteOrigin(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
}
