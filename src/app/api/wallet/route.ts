import { saveRecruit } from "@/lib/store";
import { authed, bad } from "@/lib/api";
import { isValidWallet, toPublic } from "@/lib/game";

export async function POST(req: Request) {
  const a = await authed(req);
  if ("error" in a) return a.error;
  const wallet = String(a.body.wallet ?? "").trim();
  if (!isValidWallet(wallet)) return bad("That isn't a valid Robinhood Chain or Ethereum address. It should start with 0x followed by 40 characters.");
  a.recruit.wallet = wallet;
  await saveRecruit(a.recruit);
  return Response.json({ recruit: toPublic(a.recruit) });
}
