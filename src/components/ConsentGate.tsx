"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  acceptTerms,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/consent";

const POINTS = [
  {
    heading: "This is not legal or immigration advice",
    body: "It is an educational tool that reads a statute. Only IRCC can decide whether you are a citizen, and only a licensed lawyer or CICC member can advise you on your own situation.",
  },
  {
    heading: "It can be wrong",
    body: "Parts of the government guidance behind these rules are withheld from public release, and IRCC's own documents contradict each other in places. Where an answer is genuinely unresolved you will see it flagged — but not every error will be.",
  },
  {
    heading: "Your family details stay in your browser",
    body: "Nothing you enter is sent to a server. Progress is saved on this device so a refresh does not lose your work, which is worth knowing if you are on a shared computer.",
  },
];

/**
 * Explicit one-time acceptance before the interview — clickwrap rather than
 * "by continuing you agree", which is much weaker.
 *
 * Gates the interview only. /terms, /privacy and /sources stay readable
 * without accepting, since a person cannot agree to something they are not
 * allowed to read first.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const status = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Nothing to show until the store has been read on the client.
  if (status === "loading") {
    return <div aria-hidden className="min-h-[60vh]" />;
  }

  if (status === "granted") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Before you start</h1>
      <p className="mt-3 leading-7 text-muted">
        Three things to be clear about, because they matter more here than on
        most sites.
      </p>

      <ul className="mt-8 space-y-6">
        {POINTS.map((point) => (
          <li key={point.heading}>
            <h2 className="font-medium">{point.heading}</h2>
            <p className="mt-1 leading-7 text-muted">{point.body}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={acceptTerms}
        className="mt-10 inline-flex h-11 items-center rounded-full bg-brand px-6 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        I understand — start the interview
      </button>

      <p className="mt-4 text-sm text-subtle">
        Continuing means you accept the{" "}
        <Link href="/terms" className="text-brand underline underline-offset-4">
          terms of use
        </Link>{" "}
        and the{" "}
        <Link
          href="/privacy"
          className="text-brand underline underline-offset-4"
        >
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
