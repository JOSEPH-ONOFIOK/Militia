import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, getSoldier, isValidHandle, normalizeHandle, rarityClass, soldierIdForHandle } from "@/lib/swole";

export const alt = "Militia draft card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (f: string) => readFile(join(process.cwd(), "assets", f));
const fonts = Promise.all([font("Silkscreen-Regular.ttf"), font("Silkscreen-Bold.ttf")]);

const TONE = { mythic: "#ff4fd8", elite: "#ffd34d", veteran: "#8fd8ff", grunt: "#8b927f" };

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const raw = normalizeHandle((await params).handle);
  const handle = isValidHandle(raw) ? raw : "unknown";
  const s = getSoldier(soldierIdForHandle(handle));
  const rc = rarityClass(s.rank);
  const png = await readFile(join(process.cwd(), "assets/frames", `${s.id}.png`));
  const src = `data:image/png;base64,${png.toString("base64")}`;
  const [regular, bold] = await fonts;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0c09", color: "#ebe8da", fontFamily: "Silkscreen" }}>
        <img src={src} width={630} height={630} style={{ imageRendering: "pixelated" }} alt="" />
        <div style={{ width: 8, height: "100%", background: "#ffb000" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 44px", flex: 1 }}>
          <div style={{ fontSize: 20, color: "#8b927f", letterSpacing: 3 }}>MILITIA · DRAFT PENDING</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 12 }}>
            <span style={{ fontSize: 40, color: "#8b927f", marginRight: 12 }}>NO.</span>
            <span style={{ fontSize: 96, fontWeight: 700 }}>{String(s.id)}</span>
          </div>
          <div style={{ fontSize: 34, color: "#ffb000" }}>{`@${handle}`}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 24, alignItems: "center" }}>
            <div style={{ border: `3px solid ${TONE[rc.tone]}`, color: TONE[rc.tone], padding: "4px 14px", fontSize: 26 }}>{rc.label}</div>
            <div style={{ fontSize: 26 }}>{`RARITY #${s.rank}`}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 8 }}>
            {CATEGORIES.map((c) => (
              <div key={c} style={{ display: "flex", fontSize: 20 }}>
                <span style={{ width: 200, color: "#8b927f" }}>{c.toUpperCase()}</span>
                <span>{s.traits[c]}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", fontSize: 20, color: "#ff3b30", border: "3px solid #ff3b30", padding: "6px 16px", alignSelf: "flex-start" }}>
            JOIN THE DRAFT →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Silkscreen", data: regular, weight: 400, style: "normal" },
        { name: "Silkscreen", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
