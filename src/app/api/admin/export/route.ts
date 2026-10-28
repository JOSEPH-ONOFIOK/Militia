import { store } from "@/lib/store";
import { computeXp, rankFor } from "@/lib/game";

// GET /api/admin/export?key=ADMIN_KEY  → CSV of every recruit, highest XP first
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }
  const rows = await store.all();
  const cols = ["handle", "xp", "rank", "wallet", "referrals", "referredBy", "missions", "quoteLink", "commentLink", "era", "approved", "intelReply", "soldierId", "createdAt"];
  // A leading = + - @ would run as a formula in Sheets/Excel, so neutralise it
  const esc = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) => {
    const xp = computeXp(r);
    return [r.handle, xp, rankFor(xp).name, r.wallet, r.referrals, r.referredBy,
      Object.keys(r.missions).join("|"), r.proofs?.quote, r.proofs?.tag, r.proofs?.era, r.approval?.at ? new Date(r.approval.at).toISOString() : "", r.approval?.reply, r.soldierId, new Date(r.createdAt).toISOString()].map(esc).join(",");
  });
  return new Response([cols.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="militia-allowlist.csv"`,
    },
  });
}
