import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Militia War Room. You don't pick your soldier. The Draft does.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const read = (f: string) => readFile(join(process.cwd(), "assets", f));
const SOLDIERS = [3274, 2, 1363];

export default async function Image() {
  const [regular, bold, ...frames] = await Promise.all([
    read("Silkscreen-Regular.ttf"),
    read("Silkscreen-Bold.ttf"),
    ...SOLDIERS.map((id) => read(`frames/${id}.png`)),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#050704", color: "#d8e6cc", fontFamily: "Silkscreen", padding: 56 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 22, color: "#9dff6a", letterSpacing: 4 }}>
          <div style={{ width: 12, height: 12, background: "#9dff6a", marginRight: 14 }} />
          LIVE · THE DRAFT IS OPEN
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1 }}>MILITIA</div>
            <div style={{ fontSize: 52, color: "#ffb000", marginTop: 10 }}>WAR ROOM</div>
            <div style={{ fontSize: 24, marginTop: 34, color: "#9aab8f", maxWidth: 520, lineHeight: 1.4 }}>
              You don&apos;t pick your soldier. The Draft does.
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {frames.map((f, i) => (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img key={i} src={`data:image/png;base64,${f.toString("base64")}`} width={186} height={186}
                style={{ imageRendering: "pixelated", border: "3px solid #2f4526", marginLeft: i ? 14 : 0, marginTop: i === 1 ? 60 : 0 }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#7d9172" }}>
          <span>ONE PER HANDLE · NO REROLLS</span>
          <span style={{ color: "#9dff6a" }}>@MILITIARH</span>
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
