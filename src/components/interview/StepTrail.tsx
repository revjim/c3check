"use client";

/**
 * The trail of everywhere the interview has been, one row per generation.
 *
 * Distinct from `Breadcrumb.tsx` in this folder, which is the site's trail of
 * pages. This one is a trail through a single page: the interview shows one
 * question at a time and holds all its state in a draft, so without this the
 * only way back to an earlier answer is the browser's Back button, pressed once
 * per screen, and the only way forward again is to answer everything a second
 * time.
 *
 * Every crumb carries an ordinal into the queue, read at render and used on the
 * click, so it cannot go stale between the two. What it must not do is *store*
 * one: ordinals shift as the queue changes. That is what `pendingEdit` is for,
 * and it is also why a crumb clears any pending edit on the way past. An edit
 * requested from the results page pins the interview to one screen, and a user
 * who has started clicking around the trail has plainly finished with it.
 *
 * Hidden from print, along with the rest of the interface: a printed interview
 * is a printed question, not a printed answer.
 */

import type { CrumbGroup } from "@/lib/interview";

export function StepTrail({
  groups,
  onGo,
}: {
  groups: CrumbGroup[];
  onGo: (index: number) => void;
}) {
  // Empty until there is somewhere to go; `crumbTrail` decides when that is.
  if (groups.length === 0) return null;

  return (
    <nav aria-label="Your answers so far" className="mt-4 print:hidden">
      {/* Two columns from `sm` up, so the generations line up as a column of
          names rather than a ragged left edge; stacked below that, where a name
          and its questions on one line would leave the questions nowhere. */}
      <ol className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.personId}
            className="grid gap-x-3 gap-y-1 sm:grid-cols-[11rem_1fr] sm:items-baseline"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-subtle">
              {group.label}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {group.crumbs.map((crumb) =>
                crumb.current ? (
                  <span
                    key={crumb.index}
                    aria-current="step"
                    className="rounded-full border border-brand bg-brand/10 px-2.5 py-0.5 text-xs font-medium"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    key={crumb.index}
                    type="button"
                    onClick={() => onGo(crumb.index)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {crumb.label}
                  </button>
                ),
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs leading-5 text-subtle">
        Go back to any of these to change what you said. Nothing is lost by
        looking: your other answers stay as they are.
      </p>
    </nav>
  );
}
