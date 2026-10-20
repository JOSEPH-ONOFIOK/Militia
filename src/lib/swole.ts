import data from "./swole.json";

export type Category = "Background" | "Clothing" | "Eyes" | "Head" | "Skin";
export const CATEGORIES = data.cats as Category[];
export const TRAITS = data.traits as Record<Category, string[]>;
export const SUPPLY = data.rows.length;

export type Soldier = {
  id: number;
  rank: number;
  traits: Record<Category, string>;
};

// rows: [id, bgIdx, clothingIdx, eyesIdx, headIdx, skinIdx, rarityRank], sorted by id
const ROWS = data.rows as number[][];

export function getSoldier(id: number): Soldier {
  const row = ROWS[id - 1];
  const traits = {} as Record<Category, string>;
  CATEGORIES.forEach((c, i) => (traits[c] = TRAITS[c][row[i + 1]]));
  return { id: row[0], rank: row[6], traits };
}

export const ALL_SOLDIERS: Soldier[] = ROWS.map((r) => getSoldier(r[0]));

// How many soldiers share each trait value
export const TRAIT_COUNTS: Record<Category, Record<string, number>> = (() => {
  const out = {} as Record<Category, Record<string, number>>;
  CATEGORIES.forEach((c) => (out[c] = {}));
  for (const s of ALL_SOLDIERS) {
    for (const c of CATEGORIES) out[c][s.traits[c]] = (out[c][s.traits[c]] ?? 0) + 1;
  }
  return out;
})();

export function traitPct(c: Category, value: string) {
  return (TRAIT_COUNTS[c][value] / SUPPLY) * 100;
}

export function rarityClass(rank: number) {
  if (rank <= 44) return { label: "MYTHIC", tone: "mythic" } as const;
  if (rank <= 444) return { label: "ELITE", tone: "elite" } as const;
  if (rank <= 1500) return { label: "VETERAN", tone: "veteran" } as const;
  return { label: "GRUNT", tone: "grunt" } as const;
}

export function normalizeHandle(raw: string) {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidHandle(h: string) {
  return /^[a-z0-9_]{1,15}$/.test(h);
}

// The Draft: every handle maps to exactly one soldier, forever.
export function soldierIdForHandle(handle: string) {
  let h = 0x811c9dc5;
  const s = "swole-draft:" + normalizeHandle(handle);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % SUPPLY) + 1;
}

export function serialFor(handle: string, id: number) {
  const n = soldierIdForHandle(handle + "#serial");
  return `SW-${String(id).padStart(4, "0")}-${n.toString(36).toUpperCase().padStart(3, "0")}`;
}

export const gifSrc = (id: number) => `/swole/${id}.gif`;
