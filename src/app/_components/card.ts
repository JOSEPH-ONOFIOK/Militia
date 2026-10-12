import { CATEGORIES, SUPPLY, gifSrc, rarityClass, type Soldier } from "@/lib/swole";

const TONE: Record<string, string> = { mythic: "#ff4fd8", elite: "#ffd34d", veteran: "#8fd8ff", grunt: "#8b927f" };

// Renders a 1200×675 PNG draft card on a canvas (perfect size for an X post).
export async function renderCard(handle: string, s: Soldier, serial: string) {
  const W = 1200, H = 675;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const pixel = css.getPropertyValue("--font-pixel") || "monospace";
  const mono = css.getPropertyValue("--font-mono") || "monospace";

  const img = new Image();
  img.src = gifSrc(s.id);
  await img.decode();

  g.fillStyle = "#0a0c09";
  g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, H, H);

  // scanlines
  g.fillStyle = "rgba(0,0,0,.18)";
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);

  const x = H + 48;
  g.fillStyle = "#ffb000";
  g.fillRect(H, 0, 6, H);

  g.fillStyle = "#8b927f";
  g.font = `14px ${pixel}`;
  g.fillText("SWOLEDIERS // SERVICE RECORD", x, 64);

  g.fillStyle = "#ebe8da";
  g.font = `bold 72px ${pixel}`;
  g.fillText(`#${s.id}`, x, 140);

  g.fillStyle = "#ffb000";
  g.font = `26px ${mono}`;
  g.fillText(`@${handle}`, x, 184);

  const rc = rarityClass(s.rank);
  g.strokeStyle = g.fillStyle = TONE[rc.tone];
  g.lineWidth = 2;
  g.font = `18px ${pixel}`;
  const tw = g.measureText(rc.label).width;
  g.strokeRect(x, 210, tw + 24, 34);
  g.fillText(rc.label, x + 12, 234);
  g.fillStyle = "#ebe8da";
  g.fillText(`RANK ${s.rank}/${SUPPLY}`, x + tw + 44, 234);

  g.font = `18px ${mono}`;
  CATEGORIES.forEach((cat, i) => {
    const y = 300 + i * 46;
    g.fillStyle = "#8b927f";
    g.fillText(cat.toUpperCase(), x, y);
    g.fillStyle = "#ebe8da";
    g.fillText(s.traits[cat], x + 150, y);
  });

  g.fillStyle = "#8b927f";
  g.font = `14px ${mono}`;
  g.fillText(serial, x, H - 48);

  // stamp
  g.save();
  g.translate(H - 150, H - 70);
  g.rotate(-0.1);
  g.strokeStyle = g.fillStyle = "#ff3b30";
  g.lineWidth = 4;
  g.font = `bold 30px ${pixel}`;
  g.strokeRect(-12, -38, g.measureText("DRAFTED").width + 24, 52);
  g.fillText("DRAFTED", 0, 0);
  g.restore();

  return new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}
