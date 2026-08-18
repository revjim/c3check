"use client";

/**
 * A section of the report that starts closed.
 *
 * The report is long because it shows its work, and everything below the chain
 * table is there for somebody who has decided to check the reasoning rather than
 * read the answer. Collapsed by default puts the answer, the chain and the
 * advisories on one screen, and costs one click for the rest.
 *
 * **Printing depends on `ReportActions`, and this makes that load-bearing.** A
 * closed `<details>` does not print its contents, and no CSS forces one open, so
 * `ReportActions` registers `beforeprint` to open every `<details>` under the
 * report and `afterprint` to put back exactly the ones that were closed. It is a
 * blanket `querySelectorAll("details")`, so nothing here needs wiring into it,
 * but it stops being a nicety the moment the report's substance lives in one of
 * these: a printout would silently lose the reasoning, the assumptions and the
 * document checklist.
 *
 * **A fragment link has to open the panel.** The headline links to `#unknown`
 * inside "Still unknown". Browsers are inconsistent about auto-expanding a
 * `<details>` that a fragment points into, so this does it explicitly, on mount
 * and on `hashchange`. Cheap and certain; there is nothing to gain from relying
 * on browser behaviour for a link the page itself offers.
 */

import { useEffect, useRef } from "react";

export function Collapsible({
  id,
  summary,
  children,
  className,
}: {
  /**
   * Anchor target, set on the `<details>` itself. A link to `#{id}` scrolls here
   * and opens the panel.
   */
  id?: string;
  /** The closed state has to say something. A heading, and usually a count. */
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (id === undefined) return;
    function openIfTargeted() {
      if (window.location.hash !== `#${id}`) return;
      if (details.current !== null) details.current.open = true;
    }
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, [id]);

  return (
    <details
      ref={details}
      id={id}
      className={
        // `group` so the chevron can turn on `group-open`, which is the only
        // way a child sees the open state of the details above it.
        className === undefined
          ? "group break-inside-avoid"
          : `group break-inside-avoid ${className}`
      }
    >
      <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline gap-2">
          <Chevron />
          <div className="min-w-0 flex-1">{summary}</div>
        </div>
      </summary>
      {children}
    </details>
  );
}

/**
 * The disclosure triangle, drawn rather than left to the default marker: the
 * default sits on the first line of a block and cannot be aligned with a heading
 * across browsers, and `list-style` on a summary is not honoured by all of them.
 */
function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className="mt-1.5 size-4 shrink-0 text-subtle transition-transform group-open:rotate-90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}
