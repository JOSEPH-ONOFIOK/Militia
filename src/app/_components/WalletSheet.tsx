"use client";

import { useState } from "react";
import { LuCircleAlert, LuShieldCheck, LuWallet } from "react-icons/lu";
import { XP } from "@/lib/game";
import Sheet from "./Sheet";

export default function WalletSheet({ hasWallet, onSave, onClose }: {
  hasWallet: boolean; onSave: (addr: string) => Promise<string | null>; onClose: () => void;
}) {
  const [addr, setAddr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onSave(addr.trim());
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Sheet title={hasWallet ? "Update mint wallet" : "Add mint wallet"} icon={LuWallet} onClose={onClose}>
      <form className="wallet" onSubmit={submit}>
        {hasWallet ? (
          <p className="notice ok"><LuShieldCheck aria-hidden />A wallet is on file. Saving a new one replaces it.</p>
        ) : (
          <p className="muted">Add the <b>Robinhood Chain or Ethereum</b> address you want on the allowlist and earn <b className="green">+{XP.wallet} XP</b>. Both chains use the same 0x address.</p>
        )}
        <label className="field">
          <input value={addr} onChange={(e) => { setAddr(e.target.value); setError(null); }} placeholder="0x… Robinhood Chain or Ethereum address" autoComplete="off" spellCheck={false} aria-label="Wallet address" autoFocus />
        </label>
        {error && <p className="form-error"><LuCircleAlert aria-hidden />{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy || !addr.trim()}>{hasWallet ? "Update wallet" : "Save wallet"}</button>
        <p className="fine">Public address only. We will never ask for a seed phrase or a signature.</p>
      </form>
    </Sheet>
  );
}
