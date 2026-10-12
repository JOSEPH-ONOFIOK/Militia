"use client";

import { useEffect, useRef, useState } from "react";
import { gifSrc } from "@/lib/swole";

const N = 62;

// Reveals a soldier pixel-by-pixel out of radio static, then hands over to the live animated GIF.
export default function Decode({ id, ms = 2600, onDone }: { id: number; ms?: number; onDone?: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const img = new Image();
    img.src = gifSrc(id);
    img.decode().then(() => {
      if (!alive) return;
      const off = document.createElement("canvas");
      off.width = off.height = N;
      const o = off.getContext("2d")!;
      o.drawImage(img, 0, 0, N, N);
      const src = o.getImageData(0, 0, N, N).data;

      const g = cv.current!.getContext("2d")!;
      const out = g.createImageData(N, N);
      // Reveal order: noisy top-to-bottom scan so it reads like a decrypt, not a fade
      const order = Array.from({ length: N * N }, (_, i) => i).sort(
        (a, b) => Math.floor(a / N) + Math.random() * 26 - (Math.floor(b / N) + Math.random() * 26),
      );
      const rank = new Uint32Array(N * N);
      order.forEach((p, i) => (rank[p] = i));
      const start = performance.now();

      const frame = (t: number) => {
        const k = Math.min(1, (t - start) / ms);
        const shown = Math.floor(k * k * (3 - 2 * k) * N * N);
        for (let p = 0; p < N * N; p++) {
          const j = p * 4;
          if (rank[p] < shown) {
            out.data[j] = src[j]; out.data[j + 1] = src[j + 1]; out.data[j + 2] = src[j + 2];
          } else {
            const v = Math.random() < 0.5 ? 0 : 40 + Math.random() * 120;
            out.data[j] = v * 0.4; out.data[j + 1] = v; out.data[j + 2] = v * 0.3;
          }
          out.data[j + 3] = 255;
        }
        g.putImageData(out, 0, 0);
        if (k < 1) raf = requestAnimationFrame(frame);
        else {
          setLive(true);
          done.current?.();
        }
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [id, ms]);

  return (
    <div className="decode">
      <canvas ref={cv} width={N} height={N} className="px" style={{ opacity: live ? 0 : 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {live && <img src={gifSrc(id)} alt={`Swoledier ${id}`} className="px" />}
      <div className="decode-scan" style={{ animationPlayState: live ? "paused" : "running", opacity: live ? 0 : 1 }} />
    </div>
  );
}
