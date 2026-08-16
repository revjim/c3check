"use client";

/**
 * What IRCC is doing with files like this one, which is not the same question
 * as what the Act says.
 *
 * Placed **before** the generation-by-generation table, because a processing
 * pause changes what somebody should do today and the table does not.
 *
 * This is also the only place `certificateIssued` can be asked. That fact is
 * never read by the rule engine: its one consumer is a direct lookup in
 * `advisory.ts`, and assumptions and missing facts are only recorded inside
 * `read()` in `classifyPerson`, so it can never appear in `result.missing` or
 * in `result.assumptions` and the interview queue can never reach it. It is
 * asked here, attached to the advisory that needs it, of exactly the people
 * that advisory names.
 */

import { FACTS } from "@/lib/c3/facts";
import type { Advisory, ChainResult, FactId } from "@/lib/c3";
import type { LineDraft } from "@/lib/draft";
import { addressOf, midSentence, personById } from "@/lib/draft";
import { humaniseDates } from "@/lib/format";
import { SourceLink } from "./SourceLink";

export function Advisories({
  result,
  line,
  onSetFact,
}: {
  result: ChainResult;
  line: LineDraft | null;
  onSetFact: (personId: string, factId: FactId, value: boolean) => void;
}) {
  if (result.advisories.length === 0) return null;

  return (
    <section aria-labelledby="advisories" className="mt-12">
      <h2 id="advisories" className="text-lg font-semibold tracking-tight">
        What IRCC is doing with files like this
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Separate from the classification above, and not folded into it. The Act
        says one thing; the department&apos;s current operating instructions say
        another, and you need both.
      </p>

      <div className="mt-6 space-y-6">
        {result.advisories.map((advisory) => (
          <article
            key={advisory.id}
            className="break-inside-avoid rounded-lg border border-brand/30 bg-brand/5 p-5"
          >
            <h3 className="font-medium">{advisory.title}</h3>
            <p className="mt-2 leading-7 text-muted">{humaniseDates(advisory.detail)}</p>

            {advisory.action === undefined ? null : (
              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <h4 className="text-sm font-semibold uppercase tracking-widest text-subtle">
                  What you can do
                </h4>
                <p className="mt-2 leading-7">{humaniseDates(advisory.action)}</p>
              </div>
            )}

            {advisory.orgId === undefined ? null : (
              <p className="mt-4 text-sm leading-6 text-muted">
                Files like this are given ORG ID{" "}
                <span className="font-mono text-foreground">
                  {advisory.orgId}
                </span>
                . The first character is a capital letter O, not a zero; the
                text layer of the released PDF renders it as a zero and the page
                image does not.
              </p>
            )}

            {advisory.id === "processing-pause" && line !== null ? (
              <CertificateControl
                advisory={advisory}
                line={line}
                onSetFact={onSetFact}
              />
            ) : null}

            <p className="mt-4 text-sm text-muted">
              <SourceLink sourceId={advisory.sourceId} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * The fifth of the five conditions in the 11 December 2025 bulletin, and the
 * only one a family can change. Answering yes here breaks the conjunction and
 * the advisory disappears on the next render.
 */
function CertificateControl({
  advisory,
  line,
  onSetFact,
}: {
  advisory: Advisory;
  line: LineDraft;
  onSetFact: (personId: string, factId: FactId, value: boolean) => void;
}) {
  const people = advisory.personIds
    .map((id) => personById(line, id))
    .filter((person): person is NonNullable<typeof person> => person !== null);
  if (people.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-4 print:hidden">
      <h4 className="text-sm font-semibold uppercase tracking-widest text-subtle">
        Answer this and the pause may not apply
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted">
        {FACTS.certificateIssued.why}
      </p>
      <ul className="mt-4 space-y-4">
        {people.map((person) => (
          <li key={person.id}>
            <p className="text-sm font-medium">
              Has {midSentence(addressOf(line, person))} ever been issued a
              Canadian citizenship certificate?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Choice
                pressed={person.facts.certificateIssued === true}
                onClick={() => onSetFact(person.id, "certificateIssued", true)}
                label="Yes"
              />
              <Choice
                pressed={person.facts.certificateIssued === false}
                onClick={() => onSetFact(person.id, "certificateIssued", false)}
                label="No, or not that we know of"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Choice({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        pressed
          ? "border-brand bg-brand/10 font-medium"
          : "border-border hover:bg-surface"
      }`}
    >
      {label}
    </button>
  );
}
