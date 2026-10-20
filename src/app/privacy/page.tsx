import type { Metadata } from "next";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import ConsentReset from "../_components/ConsentReset";

export const metadata: Metadata = {
  title: "Privacy and Cookies",
  description: "How Militia uses cookies and what information the war room stores about recruits.",
  alternates: { canonical: "/privacy" },
};

const COOKIES = [
  ["swole_session", "Essential", "Keeps you signed in to the war room.", "30 days"],
  ["swole_oauth", "Essential", "Protects the Sign in with X step from tampering.", "10 minutes"],
  ["swole_consent", "Essential", "Remembers your cookie choice.", "180 days"],
  ["Cloudflare Turnstile", "Essential", "Bot protection on sign in, set by Cloudflare.", "Session"],
  ["Analytics", "Optional", "Only used if you choose Accept all.", "Up to 12 months"],
];

export default function Privacy() {
  return (
    <main className="doc">
      <Link href="/" className="doc-back"><LuArrowLeft aria-hidden /> Back to the war room</Link>
      <h1>Privacy and cookies</h1>
      <p className="doc-date">Last updated October 2026</p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your X account basics.</b> When you sign in with X we receive your user ID and username. We read your account age and follower count once to decide whether your invite counts, and we keep only the yes or no result.</li>
        <li><b>Your progress.</b> Your assigned soldier, XP, completed tasks and how many people joined through your link.</li>
        <li><b>Your wallet address</b>, if you add one. It is never shown publicly.</li>
        <li><b>Your IP address</b>, briefly, to limit repeated sign in attempts. It is not stored with your profile.</li>
      </ul>
      <p>We never post to X on your behalf and we never ask for a seed phrase or wallet signature.</p>

      <h2>What is public</h2>
      <p>Your X username, assigned soldier, rank and XP appear on the radar, the leaderboard and your shareable draft card.</p>

      <h2>Cookies</h2>
      <div className="doc-table" role="table">
        <div className="doc-row head" role="row"><span>Name</span><span>Type</span><span>Purpose</span><span>Lasts</span></div>
        {COOKIES.map(([n, t, p, d]) => (
          <div className="doc-row" role="row" key={n}><span>{n}</span><span>{t}</span><span>{p}</span><span>{d}</span></div>
        ))}
      </div>
      <p>We also store your invite code in your browser so the right recruiter gets credit when you sign up.</p>
      <ConsentReset />

      <h2>Your choices</h2>
      <p>You can sign out at any time from the war room. To have your data deleted, send a direct message to <a href="https://x.com/militiaRH" target="_blank" rel="noopener">@militiaRH</a> on X from the account you signed in with.</p>
    </main>
  );
}
