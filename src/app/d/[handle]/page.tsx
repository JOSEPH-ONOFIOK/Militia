import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import Dossier from "../../_components/Dossier";
import { getSoldier, isValidHandle, normalizeHandle, rarityClass, soldierIdForHandle } from "@/lib/swole";

export async function generateMetadata({ params }: PageProps<"/d/[handle]">): Promise<Metadata> {
  const handle = normalizeHandle((await params).handle);
  if (!isValidHandle(handle)) return {};
  const s = getSoldier(soldierIdForHandle(handle));
  const title = `@${handle} joined the Militia draft`;
  const description = `Matched with Militia #${s.id}, ${rarityClass(s.rank).label}. Draft pending. Join the draft.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default function DraftCardPage({ params }: PageProps<"/d/[handle]">) {
  return (
    <main className="wrap" style={{ padding: "64px 0", display: "grid", gap: 28, minHeight: "100svh", alignContent: "center" }}>
      <Link href="/" className="pixel" style={{ color: "var(--ink)", textDecoration: "none", fontSize: 16, fontWeight: 700 }}>
        MILITIA<span style={{ color: "var(--amber)" }}>_</span>
      </Link>
      <Suspense fallback={<div className="label">Pulling service record<span className="blink">_</span></div>}>
        {params.then(({ handle }) => <Card raw={handle} />)}
      </Suspense>
    </main>
  );
}

function Card({ raw }: { raw: string }) {
  const handle = normalizeHandle(raw);
  if (!isValidHandle(handle)) notFound();
  const soldier = getSoldier(soldierIdForHandle(handle));
  return (
    <>
      <div>
        <div className="label">Draft notice</div>
        <h1 className="section-title" style={{ marginTop: 8 }}>
          @{handle} · draft pending
        </h1>
      </div>
      <Dossier soldier={soldier} handle={handle} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <a className="btn btn-primary" style={{ height: 44, padding: "0 18px" }} href={`/?ref=${handle}`}>Report to the war room <LuArrowRight aria-hidden /></a>
        <span style={{ color: "var(--dim)" }}>Signing up through this link counts toward @{handle}&apos;s rank.</span>
      </div>
    </>
  );
}
