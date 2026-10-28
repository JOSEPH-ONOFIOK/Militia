"use client";

import { useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { LuArrowUpRight, LuCheck, LuCircleAlert, LuLink, LuUsers } from "react-icons/lu";
import { MISSIONS, PINNED_POST, X_HANDLE, XP, type MissionId, type PublicRecruit } from "@/lib/game";

type Props = {
  me: PublicRecruit | null;
  onFollow: () => void;
  onProof: (id: MissionId, value: string) => Promise<string | null>; // returns an error, or null when saved
  onWallet: (addr: string) => Promise<string | null>;
  onInvite: () => void;
  highlightWallet?: boolean;
};

// The numbered task list: join, follow, like and quote, tag 3 friends, your era, your wallet
export default function Steps({ me, onFollow, onProof, onWallet, onInvite, highlightWallet }: Props) {
  const locked = !me;
  let n = 1;
  return (
    <div className="stack tight">
      <ol className="step-list">
        <Step n={n++} title="Join the draft" brief="Sign in to request CLEARANCE. The Draft matches you with a Militia soldier." done={!!me} />

        {MISSIONS.map((m) => {
          const done = !!me?.missions[m.id];
          return (
            <Step key={m.id} n={n++} title={m.title} brief={m.brief} xp={m.xp} done={done}>
              {!done && !locked && (
                m.proof === "none" ? (
                  <button className="btn btn-x" onClick={onFollow}><FaXTwitter aria-hidden />Follow @{X_HANDLE}</button>
                ) : (
                  <ProofForm
                    id={m.id}
                    multiline={m.proof === "text"}
                    placeholder={m.placeholder}
                    openPost={m.proof === "link"}
                    submitLabel={m.proof === "link" ? "Submit link" : "Submit"}
                    onSubmit={(v) => onProof(m.id, v)}
                  />
                )
              )}
            </Step>
          );
        })}

        <Step n={n++} title="Your wallet" brief="The Robinhood Chain or Ethereum address you want on the allowlist. Both chains use the same 0x address." xp={XP.wallet} done={!!me?.hasWallet} attention={highlightWallet && !!me && !me.hasWallet}>
          {!me?.hasWallet && !locked && (
            <ProofForm id="wallet" placeholder="0x…" mono submitLabel="Save wallet" onSubmit={onWallet} note="Public address only. We will never ask for a seed phrase or a signature." />
          )}
        </Step>
      </ol>

      <button className="task" onClick={onInvite} disabled={locked}>
        <span className="task-ico"><LuUsers aria-hidden /></span>
        <span className="task-body"><b>Invite friends</b><small>{me ? `${me.referrals} joined through your link` : "Copy your invite link"}</small></span>
        <span className="task-end">
          <span className="task-xp">+{XP.perReferral} each</span>
          <span className="task-cta">Copy<LuArrowUpRight aria-hidden /></span>
        </span>
      </button>
      {locked && <p className="muted fine">Sign in to unlock the steps.</p>}
    </div>
  );
}

function Step({ n, title, brief, xp, done, attention, children }: {
  n: number; title: string; brief: string; xp?: number; done: boolean; attention?: boolean; children?: React.ReactNode;
}) {
  return (
    <li className={`step ${done ? "done" : ""} ${attention ? "attention" : ""}`}>
      <span className="step-num" aria-hidden>{done ? <LuCheck /> : n}</span>
      <div className="step-main">
        <div className="step-head">
          <b>{title}</b>
          {xp !== undefined && <span className={`step-xp ${done ? "got" : ""}`}>{done ? "Done" : `+${xp} XP`}</span>}
        </div>
        {!done && <p>{brief}</p>}
        {children}
      </div>
    </li>
  );
}

function ProofForm({ id, multiline, placeholder, openPost, mono, submitLabel, note, onSubmit }: {
  id: string; multiline?: boolean; placeholder?: string; openPost?: boolean; mono?: boolean; submitLabel: string; note?: string;
  onSubmit: (value: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    const err = await onSubmit(value.trim());
    setBusy(false);
    setError(err);
    if (!err) setValue("");
  }

  const inputProps = {
    id: `step-input-${id}`,
    value,
    placeholder,
    autoComplete: "off",
    spellCheck: false,
    "aria-label": placeholder,
    "aria-invalid": !!error,
  };

  return (
    <form className="proof" onSubmit={submit}>
      {openPost && (
        <a className="btn btn-sm btn-ghost proof-open" href={PINNED_POST} target="_blank" rel="noopener"><LuLink aria-hidden />Open our post<LuArrowUpRight aria-hidden /></a>
      )}
      <div className="proof-row">
        {multiline ? (
          <textarea {...inputProps} rows={2} maxLength={280} onChange={(e) => { setValue(e.target.value); setError(null); }} />
        ) : (
          <input {...inputProps} className={mono ? "mono" : ""} onChange={(e) => { setValue(e.target.value); setError(null); }} />
        )}
        <button className="btn btn-primary" disabled={busy || !value.trim()}>{busy ? "Saving…" : submitLabel}</button>
      </div>
      {multiline && <span className="proof-count">{value.length}/280</span>}
      {error && <p className="form-error"><LuCircleAlert aria-hidden />{error}</p>}
      {note && !error && <p className="fine">{note}</p>}
    </form>
  );
}
