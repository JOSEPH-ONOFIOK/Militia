// Shared rules for XP, ranks and missions. Tweak these numbers to tune the allowlist.

export const X_HANDLE = "militiaRH";
export const X_PROFILE = `https://x.com/${X_HANDLE}`;
// The post people are asked to like and repost, set with NEXT_PUBLIC_PINNED_POST.
// Accepts any x.com or twitter.com post link (share links with ?s=… tracking are fine)
// and falls back to the profile when it's empty or isn't a post link.
const PINNED_ID = /(?:x|twitter)\.com\/\w+\/status(?:es)?\/(\d+)/i.exec(process.env.NEXT_PUBLIC_PINNED_POST ?? "")?.[1];
export const PINNED_POST = PINNED_ID ? `https://x.com/${X_HANDLE}/status/${PINNED_ID}` : X_PROFILE;

// The post pending recruits reply "$INTEL" (tagging a friend) under and repost to get approved.
// It's the pinned post (NEXT_PUBLIC_PINNED_POST). Empty means approval isn't open yet.
export const APPROVAL_POST_ID = PINNED_ID;
export const INTEL_WORD = "$INTEL";
export type ApprovalStep = "follow" | "repost" | "reply";

export type MissionId = "follow" | "quote" | "tag" | "era";
type ProofKind = "none" | "link" | "text";

// The numbered steps, in order. Step 1 is joining the draft (signing in) and the wallet is the last step.
export const MISSIONS: { id: MissionId; title: string; brief: string; xp: number; proof: ProofKind; placeholder?: string }[] = [
  { id: "follow", title: `Follow @${X_HANDLE}`, brief: "That's where the list, the mint date and everything else gets posted first.", xp: 100, proof: "none" },
  { id: "quote", title: "Like and quote", brief: "Like our post, then quote it and tell people why you're enlisting. Paste your quote link below.", xp: 250, proof: "link", placeholder: "https://x.com/you/status/…" },
  { id: "tag", title: "Reply $INTEL", brief: "Reply $INTEL under the same post and drop your wallet too. Paste the link to your reply.", xp: 200, proof: "link", placeholder: "https://x.com/you/status/…" },
  { id: "era", title: "Your era", brief: "When did you pick up your first NFT? Tell us where you were back then too, if you want.", xp: 100, proof: "text", placeholder: "2021, minting pixel art at 3am…" },
];

const POST_LINK = /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status(?:es)?\/(\d+)/i;

// Checks the proof for a step and returns the cleaned value to store.
export function checkProof(id: MissionId, raw: unknown): { ok: true; value?: string } | { ok: false; error: string } {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return { ok: false, error: "Unknown task" };
  const input = String(raw ?? "").trim();
  if (def.proof === "none") return { ok: true };
  if (def.proof === "text") {
    if (input.length < 2) return { ok: false, error: "Tell us a little more." };
    if (input.length > 280) return { ok: false, error: "Keep it under 280 characters." };
    return { ok: true, value: input };
  }
  const m = POST_LINK.exec(input);
  if (!m) return { ok: false, error: "Paste the link to your post on X. It looks like x.com/you/status/123…" };
  if (PINNED_ID && m[2] === PINNED_ID) return { ok: false, error: "That's our post. Paste the link to your own quote or comment." };
  return { ok: true, value: `https://x.com/${m[1]}/status/${m[2]}` };
}

export const XP = {
  enlist: 100,
  wallet: 100,
  perReferral: 250,
  maxReferrals: 20,
};

export const RANKS = [
  { name: "RECRUIT", min: 0, perk: "Recruit pending. Prove yourself." },
  { name: "PRIVATE", min: 400, perk: "On the radar." },
  { name: "CORPORAL", min: 800, perk: "Allowlist raffle entry" },
  { name: "SERGEANT", min: 1300, perk: "Allowlist raffle ×3 entries" },
  { name: "LIEUTENANT", min: 2000, perk: "Allowlist SECURED" },
  { name: "CAPTAIN", min: 3500, perk: "Allowlist + Militia Council role" },
] as const;

export const SECURED_AT = RANKS.find((r) => r.name === "LIEUTENANT")!.min;

// An invite only counts when the new recruit's X account looks real.
export const REFERRAL_RULES = {
  minAccountDays: Number(process.env.REF_MIN_ACCOUNT_DAYS ?? 30),
  minFollowers: Number(process.env.REF_MIN_FOLLOWERS ?? 10),
};

export type Recruit = {
  handle: string;
  xid?: string; // X user id, set when signed in with X
  refQualified?: boolean; // account passed REFERRAL_RULES
  soldierId: number;
  referredBy?: string;
  referrals: number;
  missions: Partial<Record<MissionId, number>>; // timestamp completed
  proofs?: Partial<Record<MissionId, string>>; // quote and comment links, era answer; never sent to other visitors
  // Pending → Approved: follow and repost taps, the verified "$INTEL" reply, and when approval happened
  approval?: { follow?: number; repost?: number; reply?: string; at?: number };
  wallet?: string;
  createdAt: number;
  rev?: number; // revision, used by the Google Sheets store to detect concurrent saves
};

export type PublicRecruit = Omit<Recruit, "wallet" | "xid" | "proofs" | "approval"> & {
  xp: number;
  hasWallet: boolean;
  approved: boolean;
  approvalSteps: Record<ApprovalStep, boolean>;
};

export function computeXp(r: Recruit) {
  let xp = XP.enlist;
  for (const m of MISSIONS) if (r.missions[m.id]) xp += m.xp;
  xp += Math.min(r.referrals, XP.maxReferrals) * XP.perReferral;
  if (r.wallet) xp += XP.wallet;
  return xp;
}

export function rankFor(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++;
  return { ...RANKS[i], index: i, next: RANKS[i + 1] };
}

export function toPublic(r: Recruit): PublicRecruit {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { wallet, xid, proofs, approval, ...rest } = r;
  return {
    ...rest,
    xp: computeXp(r),
    hasWallet: !!wallet,
    approved: !!approval?.at,
    approvalSteps: { follow: !!approval?.follow, repost: !!approval?.repost, reply: !!approval?.reply },
  };
}

// Robinhood Chain and Ethereum share the same 0x address format, so one address works on both
export function isValidWallet(w: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(w);
}

// Approval needs all three: the follow and repost taps and a verified "$INTEL" reply
export function maybeApprove(r: Recruit) {
  const a = r.approval;
  if (a && !a.at && a.follow && a.repost && a.reply) a.at = Date.now();
  return !!r.approval?.at;
}
