"use client";

import { useEffect, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { LuDownload, LuLink, LuShare, LuShare2 } from "react-icons/lu";
import { X_HANDLE, type PublicRecruit } from "@/lib/game";
import { getSoldier, rarityClass, serialFor } from "@/lib/swole";
import Sheet from "./Sheet";

export function shareText(r: PublicRecruit) {
  const s = getSoldier(r.soldierId);
  const rc = rarityClass(s.rank);
  if (r.approved) return `Clearance APPROVED 🪖\n\nMilitia #${s.id} · ${rc.label} (rarity #${s.rank}) reporting for duty.\n\nGet yours in the @${X_HANDLE} war room 👇`;
  return `Joined the Militia draft. Recruit pending 🪖\n\nMatched with Militia #${s.id} · ${rc.label} (rarity #${s.rank})\n\nYou don't pick yours. Report to the @${X_HANDLE} war room 👇`;
}

// Preview the draft card, then post, download, copy or hand it to the phone's share sheet
export default function ShareSheet({ recruit, onPosted, onClose, toast }: {
  recruit: PublicRecruit; onPosted: () => void; onClose: () => void; toast: (m: string) => void;
}) {
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const s = getSoldier(recruit.soldierId);
  const link = typeof window !== "undefined" ? `${location.origin}/d/${recruit.handle}` : "";
  const file = img ? new File([img.blob], `militia-${s.id}-${recruit.handle}.png`, { type: "image/png" }) : null;
  const canNative = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  useEffect(() => {
    let url = "";
    const soldier = getSoldier(recruit.soldierId);
    import("./card")
      .then(({ renderCard }) => renderCard(recruit.handle, soldier, serialFor(recruit.handle, soldier.id), recruit.approved))
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setImg({ url, blob });
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [recruit.handle, recruit.soldierId, recruit.approved]);

  function postX() {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(shareText(recruit))}&url=${encodeURIComponent(link)}`, "_blank", "noopener");
    onPosted();
    onClose();
  }

  async function native() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: shareText(recruit), url: link });
      onPosted();
      onClose();
    } catch {}
  }

  function download() {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url;
    a.download = file!.name;
    a.click();
    toast("Card downloaded");
  }

  return (
    <Sheet title={recruit.approved ? "You're approved. Post your card" : "Share your draft card"} icon={LuShare2} onClose={onClose} wide>
      <div className="share">
        <div className="share-preview">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.url} alt={`Draft card for @${recruit.handle}, Militia #${s.id}`} />
          ) : (
            <div className="skel" style={{ aspectRatio: "16 / 9" }} />
          )}
        </div>
        <div className="share-actions">
          <button className="btn btn-x btn-lg" onClick={postX}><FaXTwitter aria-hidden />Post on X</button>
          {canNative && <button className="btn btn-primary btn-lg" onClick={native}><LuShare aria-hidden />Share image</button>}
          <div className="share-row">
            <button className="btn btn-ghost" onClick={download} disabled={!img}><LuDownload aria-hidden />Download</button>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(link); toast("Link copied"); }}><LuLink aria-hidden />Copy link</button>
          </div>
          <p className="fine">Your link opens a page with your soldier, and anyone who signs up through it counts as your invite.</p>
        </div>
      </div>
    </Sheet>
  );
}
