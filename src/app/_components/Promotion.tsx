"use client";

import { useEffect } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { LuShieldCheck } from "react-icons/lu";
import { X_HANDLE, rankFor, type PublicRecruit } from "@/lib/game";
import { gifSrc } from "@/lib/swole";

// Full screen moment when a recruit climbs a rank
export default function Promotion({ recruit, secured, onClose }: { recruit: PublicRecruit; secured: boolean; onClose: () => void }) {
  const rank = rankFor(recruit.xp);

  useEffect(() => {
    navigator.vibrate?.([30, 40, 60]);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function share() {
    const text = secured
      ? `Allowlist secured. I just made ${rank.name} in the @${X_HANDLE} war room 🪖\n\nFree mint. Join the draft 👇`
      : `Promoted to ${rank.name} in the @${X_HANDLE} war room 🪖\n\nFree mint. Join the draft 👇`;
    const url = `${location.origin}/d/${recruit.handle}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
  }

  return (
    <div className="overlay promo-back" onClick={onClose}>
      <div className={`promo ${secured ? "secured" : ""}`} role="dialog" aria-label={`Promoted to ${rank.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="burst" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 20}deg`, ["--d" as string]: `${(i % 3) * 60}ms` }} />)}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gifSrc(recruit.soldierId)} alt="" className="px promo-art" />
        <span className="eyebrow">{secured ? "Allowlist secured" : "Promotion"}</span>
        <h2>{rank.name}</h2>
        <p>{secured ? "You made Lieutenant. Your allowlist spot is locked in." : rank.perk}</p>
        {secured && <span className="pill tone-elite"><LuShieldCheck aria-hidden />Allowlist secured</span>}
        <div className="promo-actions">
          <button className="btn btn-x btn-lg" onClick={share}><FaXTwitter aria-hidden />Share my promotion</button>
          <button className="btn btn-ghost btn-lg" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}
