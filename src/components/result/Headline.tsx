"use client";

/**
 * The answer, in one card.
 *
 * **No green and no red.** Red is barred by the brand rule; green would imply a
 * certainty this tool spends the rest of the page disclaiming; and the pair of
 * them together is unreadable for a good fraction of colour-blind readers.
 * `qualifies` gets the emphatic card and everything else the neutral one, and
 * the confidence is a sentence rather than a badge, because a badge cannot say
 * "rests on a reading IRCC has not confirmed".
 *
 * Three cases that are easy to get wrong and are handled here:
 *
 * - `qualifies` with `paragraph === null` is real. Someone who became a citizen
 *   on 1 January 1947 under the 1946 Act and died before 1977 is a citizen, and
 *   a valid (q) parent, and no paragraph of section 3(1) as it now reads
 *   describes them. It must never render as a failure.
 * - `incomplete` is an invitation, not a verdict, so it gets a button.
 * - `undetermined` never uses the word "fails" anywhere.
 */

import Link from "next/link";
import { provisionOf } from "@/lib/c3";
import type { ChainResult } from "@/lib/c3";
import { buttonClasses } from "@/components/button";
import { formatDate, humaniseDates } from "@/lib/format";
import { confidenceWord, verdictWord } from "@/lib/report";

export function Headline({
  result,
  stopped,
}: {
  result: ChainResult;
  /** True when a stop block is carrying the answer above this. */
  stopped: boolean;
}) {
  const { headline } = result;
  const emphatic = headline.verdict === "qualifies";

  return (
    <section
      aria-labelledby="headline"
      className={`break-inside-avoid rounded-lg border p-6 ${
        emphatic ? "border-brand/30 bg-brand/5" : "border-border bg-surface"
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-subtle">
        {stopped ? "As far as this goes" : "The answer"}
      </p>
      <h2 id="headline" className="mt-2 text-xl font-semibold tracking-tight text-balance">
        {verdictWord(headline.verdict)}
      </h2>
      <p className="mt-3 leading-7">{humaniseDates(headline.summary)}</p>

      {headline.paragraph === null && headline.effectiveDate === null ? null : (
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {headline.paragraph === null ? null : (
            <div>
              <dt className="text-subtle">Paragraph</dt>
              <dd className="mt-0.5 font-mono text-base">
                {provisionOf(headline.paragraph)}
              </dd>
            </div>
          )}
          {headline.effectiveDate === null ? null : (
            <div>
              <dt className="text-subtle">Citizenship effective</dt>
              <dd className="mt-0.5 text-base">
                {formatDate(headline.effectiveDate)}
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-5 text-sm leading-6 text-muted">
        Confidence: {confidenceWord(headline.confidence)}.
      </p>

      {headline.verdict === "incomplete" ? (
        <Link href="/check/interview" className={buttonClasses("primary", "mt-6")}>
          Add an earlier generation
        </Link>
      ) : null}

      {headline.verdict === "undetermined" ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          This is not a no. It means something the answer turns on has not been
          established yet.{" "}
          <a href="#unknown" className="text-brand underline underline-offset-4">
            What is still unknown
          </a>{" "}
          lists each one and the records that would settle it.
        </p>
      ) : null}
    </section>
  );
}
