"use client";

/**
 * The quiet strip above the question.
 *
 * **Never the verdict.** Saying "qualifies" halfway through and retracting it
 * two screens later is the worst thing this interface could do, and the word
 * "fails" has no business appearing before the last question is answered. So
 * this counts what has been entered and nothing else. `progressSummary` in
 * `interview.ts` enforces that, and its test asserts the words never appear.
 *
 * There is no progress bar either, and no percentage. There is no honest one to
 * give: only questions that could still change the answer get asked, so the
 * list genuinely grows and shrinks as you go.
 */

import { PROGRESS_NOTE, progressSummary } from "@/lib/interview";
import type { LineDraft } from "@/lib/draft";

export function StatusStrip({ line }: { line: LineDraft }) {
  return (
    <div className="border-b border-border pb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-subtle">
        {line.name}
      </p>
      <p aria-live="polite" className="mt-1 text-sm font-medium">
        {progressSummary(line)}
      </p>
      <p className="mt-1 text-sm leading-6 text-subtle">{PROGRESS_NOTE}</p>
    </div>
  );
}
