"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { resetDraft } from "@/lib/draftStore";
import { ISSUES_URL } from "@/lib/site";

/**
 * The belt-and-braces for a corrupt or stale saved draft.
 *
 * `migrateDraft` and `classifyLine` are the belt: between them they refuse to
 * hand the engine an empty chain or a half-typed date, both of which throw. This
 * is the braces, and it matters more than an error boundary usually does,
 * because the thing that went wrong is stored on the user's device and will be
 * there again on reload.
 *
 * Hence two actions rather than one. Without the second, a draft that trips
 * this would brick /check permanently for that browser, with no way out but
 * devtools.
 */
export default function CheckError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  function discard() {
    resetDraft();
    retry();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong reading your saved interview
      </h1>
      <p className="mt-3 leading-7 text-muted">
        This is a bug rather than anything you did. Your family details are
        still on this device and were not sent anywhere.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => retry()} className={buttonClasses("primary")}>
          Try again
        </button>
        <button type="button" onClick={discard} className={buttonClasses("secondary")}>
          Discard the saved draft and start over
        </button>
      </div>

      <p className="mt-4 text-sm text-subtle">
        Discarding erases the line you have entered on this device. Try again
        first; if it fails a second time, the saved draft is the problem and
        discarding is the way out.
      </p>

      <p className="mt-8 leading-7 text-muted">
        Reporting it helps:{" "}
        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-4"
        >
          open an issue
        </a>
        {error.digest === undefined ? null : (
          <>
            {" "}
            and quote{" "}
            <code className="font-mono text-sm">{error.digest}</code>
          </>
        )}
        . Issues are public, so please do not include any family details in one.
      </p>

      <p className="mt-6">
        <Link href="/" className="text-brand underline underline-offset-4">
          Back to the start
        </Link>
      </p>
    </div>
  );
}
