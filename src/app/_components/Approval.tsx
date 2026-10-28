"use client";

import { useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { LuArrowUpRight, LuCheck, LuCircleAlert, LuMessageSquareReply, LuRepeat2, LuShieldCheck, LuUserPlus } from "react-icons/lu";
import { APPROVAL_POST_ID, INTEL_WORD, X_HANDLE, type ApprovalStep, type PublicRecruit } from "@/lib/game";

const LINKS = {
  follow: `https://x.com/intent/follow?screen_name=${X_HANDLE}`,
  repost: `https://x.com/intent/retweet?tweet_id=${APPROVAL_POST_ID}`,
  reply: `https://x.com/intent/tweet?in_reply_to=${APPROVAL_POST_ID}&text=${encodeURIComponent(INTEL_WORD)}`,
};

// Pending → Approved: follow, repost, and reply "$intel" under the approval post
export default function Approval({ me, onStep, onReply }: {
  me: PublicRecruit;
  onStep: (step: Exclude<ApprovalStep, "reply">) => void;
  onReply: (link: string) => Promise<string | null>;
}) {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me.approved) {
    return (
      <div className="approval approved" id="approval">
        <span className="ap-ico"><LuShieldCheck aria-hidden /></span>
        <div><b>Clearance approved</b><p>You moved from Pending to Approved.</p></div>
      </div>
    );
  }

  if (!APPROVAL_POST_ID) {
    return (
      <div className="approval" id="approval">
        <div className="ap-head"><b>Get approved</b><span className="pill pending">Pending</span></div>
        <p className="muted">Approval opens soon. Follow @{X_HANDLE}: the post you&apos;ll reply to goes up there first.</p>
      </div>
    );
  }

  const s = me.approvalSteps;
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !link.trim()) return;
    setBusy(true);
    const err = await onReply(link.trim());
    setBusy(false);
    setError(err);
    if (!err) setLink("");
  }

  return (
    <div className="approval" id="approval">
      <div className="ap-head">
        <b>Get approved</b>
        <span className="pill pending">Pending</span>
      </div>
      <p className="muted">Do these three on X to move from Pending to Approved.</p>
      <ol className="ap-list">
        <li className={s.follow ? "done" : ""}>
          <span className="ap-num">{s.follow ? <LuCheck aria-hidden /> : <LuUserPlus aria-hidden />}</span>
          <span className="ap-text">Follow @{X_HANDLE}</span>
          {!s.follow && (
            <a className="btn btn-sm btn-x" href={LINKS.follow} target="_blank" rel="noopener" onClick={() => onStep("follow")}><FaXTwitter aria-hidden />Follow</a>
          )}
        </li>
        <li className={s.repost ? "done" : ""}>
          <span className="ap-num">{s.repost ? <LuCheck aria-hidden /> : <LuRepeat2 aria-hidden />}</span>
          <span className="ap-text">Repost our post</span>
          {!s.repost && (
            <a className="btn btn-sm btn-x" href={LINKS.repost} target="_blank" rel="noopener" onClick={() => onStep("repost")}><FaXTwitter aria-hidden />Repost</a>
          )}
        </li>
        <li className={`ap-reply ${s.reply ? "done" : ""}`}>
          <span className="ap-num">{s.reply ? <LuCheck aria-hidden /> : <LuMessageSquareReply aria-hidden />}</span>
          <span className="ap-text">Reply <code>{INTEL_WORD}</code> under the post</span>
          {!s.reply && (
            <a className="btn btn-sm btn-x" href={LINKS.reply} target="_blank" rel="noopener"><FaXTwitter aria-hidden />Reply<LuArrowUpRight aria-hidden /></a>
          )}
          {!s.reply && (
            <form className="ap-form" onSubmit={verify}>
              <div className="proof-row">
                <input
                  id="approval-reply"
                  value={link}
                  onChange={(e) => { setLink(e.target.value); setError(null); }}
                  placeholder="Paste your reply link"
                  aria-label="Your reply link"
                  aria-invalid={!!error}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="btn btn-primary" disabled={busy || !link.trim()}>{busy ? "Checking…" : "Verify"}</button>
              </div>
              {error && <p className="form-error"><LuCircleAlert aria-hidden />{error}</p>}
            </form>
          )}
        </li>
      </ol>
      <p className="fine">We check your reply on X automatically. Follows and reposts are spot checked by the team.</p>
    </div>
  );
}
