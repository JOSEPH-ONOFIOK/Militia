// Shared rules for XP, ranks and missions. Tweak these numbers to tune the allowlist.

export const X_HANDLE = "militiaRH";
export const X_PROFILE = `https://x.com/${X_HANDLE}`;
// Set NEXT_PUBLIC_PINNED_POST to the status URL you want people to repost.
export const PINNED_POST = process.env.NEXT_PUBLIC_PINNED_POST || X_PROFILE;

export type MissionId = "follow" | "repost" | "share" | "notify";

export const MISSIONS: { id: MissionId; title: string; brief: string; xp: number }[] = [
  { id: "follow", title: "Report to command", brief: `Follow @${X_HANDLE} on X`, xp: 100 },
  { id: "repost", title: "Signal boost", brief: "Like + repost the pinned transmission", xp: 150 },
  { id: "share", title: "Show your dog tags", brief: "Post your Draft Card on X", xp: 250 },
  { id: "notify", title: "Radio check", brief: `Turn on post notifications for @${X_HANDLE}`, xp: 50 },
];

export const XP = {
  enlist: 100,
  wallet: 100,
  perReferral: 250,
  maxReferrals: 20,
  drillPerPoint: 10,
  drillMax: 500,
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
  drillBest: number;
  wallet?: string;
  createdAt: number;
  rev?: number; // revision, used by the Google Sheets store to detect concurrent saves
};

export type PublicRecruit = Omit<Recruit, "wallet" | "xid"> & { xp: number; hasWallet: boolean };

export function computeXp(r: Recruit) {
  let xp = XP.enlist;
  for (const m of MISSIONS) if (r.missions[m.id]) xp += m.xp;
  xp += Math.min(r.referrals, XP.maxReferrals) * XP.perReferral;
  xp += Math.min(r.drillBest * XP.drillPerPoint, XP.drillMax);
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
  const { wallet, xid, ...rest } = r;
  return { ...rest, xp: computeXp(r), hasWallet: !!wallet };
}

export function isValidWallet(w: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(w) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w);
}
