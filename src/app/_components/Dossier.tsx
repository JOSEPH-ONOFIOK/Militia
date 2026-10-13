import { CATEGORIES, gifSrc, rarityClass, serialFor, traitPct, type Soldier } from "@/lib/swole";

// The draft card. Used in the Draft reveal, the Barracks modal and the /d/[handle] share page.
export default function Dossier({ soldier, handle }: { soldier: Soldier; handle?: string }) {
  const rc = rarityClass(soldier.rank);
  return (
    <div className="panel hud reveal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      <div className="dossier-art" style={{ background: "#000", borderRight: "1px solid var(--line)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gifSrc(soldier.id)} alt={`Militia #${soldier.id}`} className="px" style={{ width: "100%", aspectRatio: "1" }} />
        {handle && <span className="stamp">Pending</span>}
      </div>
      <div style={{ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div>
            <div className="label">{handle ? "Service record" : "Personnel file"}</div>
            <div className="pixel" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 4 }}>
              <span style={{ fontSize: 16, color: "var(--dim)", marginRight: 6 }}>NO.</span>{soldier.id}
            </div>
            {handle && <div style={{ color: "var(--amber)", marginTop: 2 }}>@{handle}</div>}
          </div>
          <span className={`tag tone-${rc.tone}`}>{rc.label}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat k="Rarity rank" v={`#${soldier.rank}`} />
          <Stat k="Serial" v={handle ? serialFor(handle, soldier.id) : `SW-${String(soldier.id).padStart(4, "0")}`} />
        </div>

        <div style={{ display: "grid", gap: 9 }}>
          {CATEGORIES.map((c) => {
            const pct = traitPct(c, soldier.traits[c]);
            return (
              <div key={c}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span><span className="label" style={{ fontSize: 10, marginRight: 8 }}>{c}</span>{soldier.traits[c]}</span>
                  <span style={{ color: pct < 5 ? "var(--mythic)" : pct < 10 ? "var(--gold)" : "var(--dim)" }}>{pct.toFixed(1)}%</span>
                </div>
                <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${Math.max(3, 100 - pct * 2.4)}%`, background: pct < 5 ? "var(--mythic)" : pct < 10 ? "var(--gold)" : "var(--amber)" }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ background: "#070906", border: "1px solid var(--line)", padding: "8px 10px" }}>
      <div className="label" style={{ fontSize: 9 }}>{k}</div>
      <div className="pixel" style={{ fontSize: 15, marginTop: 2 }}>{v}</div>
    </div>
  );
}
