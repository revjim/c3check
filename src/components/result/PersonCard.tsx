"use client";

/**
 * One generation, in full.
 *
 * A card rather than a row in a table. Twelve fields is unreadable as twelve
 * columns at 375px, and a card takes `break-inside: avoid` so a printed report
 * never splits a generation across a page break. `ChainTable` above is the
 * four-column view of the same people, and the two are not in competition: that
 * one is for scanning, this one is everything the engine has to say.
 *
 * Collapsed by default, so a five-generation report is five lines rather than
 * five screens. The summary carries the name, the paragraph and the outcome, so
 * a closed card still answers the question the card exists to answer.
 */

import type { Status } from "@/lib/c3";
import { provisionOf } from "@/lib/c3";
import { formatBirthDate, formatDate, humaniseDates, plural } from "@/lib/format";
import { amendmentWord } from "@/lib/report";
import { Collapsible } from "./Collapsible";
import { SourceLink } from "./SourceLink";

export function PersonCard({
  status,
  index,
  approximateBirth = false,
  children,
}: {
  status: Status;
  index: number;
  approximateBirth?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="break-inside-avoid rounded-lg border border-border p-5">
      <Collapsible
        summary={
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-medium">{status.label}</h3>
            {status.paragraph === null ? null : (
              <span className="font-mono text-sm text-muted">
                {provisionOf(status.paragraph)}
              </span>
            )}
            <span className="text-sm text-subtle">{shortOutcome(status)}</span>
            {index === 0 ? (
              <span className="text-sm text-subtle">
                Earliest generation entered
              </span>
            ) : null}
          </div>
        }
      >
        <dl className="mt-4 space-y-3 text-sm leading-6">
          <Row label="Born">
            {formatBirthDate(status.birthDate, approximateBirth)}
            {status.deathDate === null
              ? null
              : `, died ${formatDate(status.deathDate)}`}
          </Row>

          <Row label="Outcome">{outcomeSentence(status)}</Row>

          {status.paragraph === null ? null : (
            <Row label="Paragraph">
              <span className="font-mono">{provisionOf(status.paragraph)}</span>
            </Row>
          )}

          {status.effectiveDate === null ? null : (
            <Row label="Citizenship effective">
              {formatDate(status.effectiveDate)}
              {status.deemingProvision === null ? null : (
                <>
                  {" "}
                  <span className="text-muted">
                    by subsection{" "}
                    <span className="font-mono">{status.deemingProvision}</span>,
                    which is what sets the date rather than the birth
                  </span>
                </>
              )}
            </Row>
          )}

          {status.remediedBy === null ? null : (
            <Row label="Brought inside section 3(1) by">
              {amendmentWord(status.remediedBy)}
            </Row>
          )}

          <Row label="Where in the line">
            {status.generationAbroad === 0
              ? "Born in Canada, or in Newfoundland and Labrador before it joined Confederation. This is the anchor the rest of the line reasons from."
              : `${plural(status.generationAbroad, "generation", "generations")} born outside Canada.`}
          </Row>

          {status.alternatives.length === 0 ? null : (
            <Row label="Also described by">
              {status.alternatives
                .map((paragraph) => provisionOf(paragraph))
                .join(" and ")}
              . Those describe this person too, but lost: subsections 3(6.3) and
              3(6.4) say which paragraph a person described by more than one is
              deemed to be a citizen under, and the reasoning below says which
              rule did the work.
            </Row>
          )}

          {status.orgId === null ? null : (
            <Row label="IRCC processing category">
              <span className="font-mono">{status.orgId.id}</span>,{" "}
              {status.orgId.name}
              <details className="mt-2">
                <summary className="cursor-pointer text-muted">
                  What IRCC records against this ORG ID
                </summary>
                <ul className="mt-2 ml-5 list-disc space-y-1 text-muted">
                  {status.orgId.criteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </details>
            </Row>
          )}
        </dl>

        {status.stopReason === null ? null : (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm leading-6">
            <p className="font-medium">{status.stopReason.title}</p>
            <p className="mt-1 text-muted">{humaniseDates(status.stopReason.detail)}</p>
            <p className="mt-2 text-muted">
              <span className="font-mono">{status.stopReason.provision}</span>
              {". "}
              <SourceLink sourceId={status.stopReason.sourceId} />
            </p>
          </div>
        )}

        {status.flags.length === 0 ? null : (
          <ul className="mt-4 space-y-3">
            {status.flags.map((flag) => (
              <li
                key={`${flag.id}-${flag.title}`}
                className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm leading-6"
              >
                <p className="font-medium">{flag.title}</p>
                <p className="mt-1 text-muted">{humaniseDates(flag.detail)}</p>
                <p className="mt-2 text-muted">
                  <SourceLink sourceId={flag.sourceId} />
                </p>
              </li>
            ))}
          </ul>
        )}

        {children}
      </Collapsible>
    </li>
  );
}

/**
 * The outcome in three or four words, for a card that is closed.
 *
 * Same rule as everywhere else: `undetermined` is never rendered as a failure
 * and never as anything that reads like one.
 */
function shortOutcome(status: Status): string {
  switch (status.outcome) {
    case "qualifies":
      return "A citizen, on the facts given";
    case "fails":
      return "No paragraph applies";
    case "undetermined":
      return "Not answerable yet";
    case "stopped":
      return "This tool stops here";
    case "incomplete":
      return "Nothing to reason from yet";
  }
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sm:flex sm:gap-4">
      <dt className="shrink-0 font-medium sm:w-52">{label}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}

/**
 * The word for an outcome.
 *
 * `undetermined` is never rendered as a failure and never as anything that
 * reads like one. It means "cannot answer without more information", which is
 * a different thing from "not a citizen", and the difference decides whether
 * somebody carries on looking.
 */
function outcomeSentence(status: Status): string {
  switch (status.outcome) {
    case "qualifies":
      return status.paragraph === null
        ? "Already a citizen under the Canadian Citizenship Act as it then stood. No paragraph of section 3(1) as it now reads describes them, because none needs to."
        : "A citizen by operation of law, on the facts given.";
    case "fails":
      return "No paragraph of section 3(1) describes them on the facts given.";
    case "undetermined":
      return "Not answerable yet. Something this generation turns on has not been established.";
    case "stopped":
      return "This tool stops short of classifying this generation, on purpose.";
    case "incomplete":
      return "Nothing to reason from yet.";
  }
}
