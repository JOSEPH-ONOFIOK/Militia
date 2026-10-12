"use client";

import { useEffect, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuX } from "react-icons/lu";

// Modal shell shared by the share, wallet and personnel file dialogs
export default function Sheet({ title, icon: Icon, onClose, wide, children }: {
  title: string; icon?: IconType; onClose: () => void; wide?: boolean; children: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`frame ${wide ? "wide" : ""}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="frame-head">
          <span className="ph-title">{Icon && <Icon aria-hidden />}{title}</span>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close"><LuX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
