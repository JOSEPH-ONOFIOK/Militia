import { getSoldier, soldierIdForHandle } from "./swole";

// Every soldier's background colour decides their side in the faction war.
export const FACTIONS = {
  Blue: { name: "Blue Battalion", color: "#6fb7ff" },
  Gray: { name: "Gray Garrison", color: "#c3cbbd" },
  Green: { name: "Green Guard", color: "#8de868" },
} as const;

export type FactionKey = keyof typeof FACTIONS;
export const FACTION_KEYS = Object.keys(FACTIONS) as FactionKey[];

export const factionOf = (soldierId: number) => getSoldier(soldierId).traits.Background as FactionKey;
export const factionOfHandle = (handle: string) => factionOf(soldierIdForHandle(handle));

export function standings(recruits: { handle: string; xp: number }[]) {
  const t = Object.fromEntries(FACTION_KEYS.map((k) => [k, { key: k, xp: 0, members: 0 }])) as Record<FactionKey, { key: FactionKey; xp: number; members: number }>;
  for (const r of recruits) {
    const f = t[factionOfHandle(r.handle)];
    f.xp += r.xp;
    f.members += 1;
  }
  return Object.values(t).sort((a, b) => b.xp - a.xp);
}
