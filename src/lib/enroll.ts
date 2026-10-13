import { after } from "next/server";
import { getRecruit, saveRecruit, store } from "./store";
import { REFERRAL_RULES, type Recruit } from "./game";
import { isValidHandle, normalizeHandle, soldierIdForHandle } from "./swole";
import type { XUser } from "./auth";

export function qualifies(u: XUser) {
  const days = u.created_at ? (Date.now() - Date.parse(u.created_at)) / 864e5 : 0;
  return days >= REFERRAL_RULES.minAccountDays && (u.public_metrics?.followers_count ?? 0) >= REFERRAL_RULES.minFollowers;
}

// Finds or creates the recruit for a signed-in account. Credits the referrer only for new, qualified accounts.
// Pass `existing` when the caller already looked the handle up, to skip a second read.
export async function enroll(opts: { handle: string; xid?: string; qualified: boolean; ref?: string; existing?: Recruit | null }) {
  let handle = normalizeHandle(opts.handle);

  // Someone who renamed on X keeps their original soldier
  if (opts.xid) {
    const linked = await store.handleForXid(opts.xid);
    if (linked) handle = linked;
  }

  const existing = opts.existing !== undefined && !opts.xid ? opts.existing : await getRecruit(handle);
  if (existing) {
    if (opts.xid && existing.xid && existing.xid !== opts.xid) {
      throw new Error("handle_taken");
    }
    if (opts.xid && !existing.xid) {
      existing.xid = opts.xid;
      await saveRecruit(existing);
      await store.linkXid(opts.xid, handle);
    }
    return { recruit: existing, isNew: false };
  }

  const ref = normalizeHandle(opts.ref ?? "");
  const referredBy = ref && ref !== handle && isValidHandle(ref) ? ref : undefined;

  // Crediting the inviter takes extra round trips on slow stores (Google Sheets),
  // so it runs after the new recruit has their response. A link from someone who
  // never enlisted is simply ignored there.
  if (referredBy && opts.qualified) {
    after(async () => {
      try {
        if (await getRecruit(referredBy)) await store.addReferral(referredBy);
      } catch (e) {
        console.error("invite credit failed for", referredBy, e);
      }
    });
  }

  const recruit: Recruit = {
    handle,
    xid: opts.xid,
    refQualified: opts.qualified,
    soldierId: soldierIdForHandle(handle),
    referredBy,
    referrals: 0,
    missions: {},
    drillBest: 0,
    createdAt: Date.now(),
  };
  await saveRecruit(recruit, true);
  if (opts.xid) await store.linkXid(opts.xid, handle);
  return { recruit, isNew: true };
}
