import { store } from "@/lib/store";
import { computeXp, rankFor } from "@/lib/game";

// GET /api/admin/export?key=ADMIN_KEY  → CSV of every recruit, highest XP first
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }
  const rows = await store.all();
  const cols = ["handle", "xp", "rank", "wallet", "referrals", "referredBy", "drillBest", "missions", "soldierId", "createdAt"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => {
    const xp = computeXp(r);
    return [r.handle, xp, rankFor(xp).name, r.wallet, r.referrals, r.referredBy, r.drillBest,
      Object.keys(r.missions).join("|"), r.soldierId, new Date(r.createdAt).toISOString()].map(esc).join(",");
  });
  return new Response([cols.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="militia-allowlist.csv"`,
    },
  });
}
