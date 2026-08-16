"use client";

/**
 * The parts of the report below the generation list: what is uncertain, what
 * was assumed, what is still unknown, what to go and find, and the reasoning in
 * full.
 *
 * The order is deliberate and runs from "what changes your answer" to "how the
 * answer was reached". Somebody skimming should hit the actionable things
 * first; somebody checking the work should find every provision that was
 * considered, including the ones that did not apply.
 */

import type {
  Assumption,
  ChainResult,
  FactId,
  MissingFact,
  RuleTrace,
  UncertaintyFlag,
} from "@/lib/c3";
import { buttonClasses } from "@/components/button";
import { humaniseDates, plural } from "@/lib/format";
import { documentChecklist } from "@/lib/report";
import type { AssumptionGroups } from "@/lib/report";
import { SourceLink } from "./SourceLink";

// ---------------------------------------------------------------------------
// Uncertainty flags
// ---------------------------------------------------------------------------

export function Flags({ result }: { result: ChainResult }) {
  if (result.flags.length === 0) return null;

  // Grouped by id: the same reading, flagged against three generations, is one
  // thing to understand rather than three.
  const groups = new Map<string, UncertaintyFlag[]>();
  for (const flag of result.flags) {
    groups.set(flag.id, [...(groups.get(flag.id) ?? []), flag]);
  }

  return (
    <section aria-labelledby="flags" className="mt-12">
      <h2 id="flags" className="text-lg font-semibold tracking-tight">
        Where this is uncertain
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Each of these is a point where the sources are contested, withheld, or
        silent. The classification above follows the statute; these say where
        somebody applying it might not.
      </p>

      <div className="mt-6 space-y-6">
        {[...groups.values()].map((flags) => (
          <article
            key={flags[0].id}
            className="break-inside-avoid rounded-lg border border-border p-5"
          >
            <h3 className="font-medium">{flags[0].title}</h3>
            <p className="mt-2 leading-7 text-muted">{humaniseDates(flags[0].detail)}</p>
            {flags.length > 1 ? (
              <p className="mt-2 text-sm text-subtle">
                Flagged against {plural(flags.length, "generation", "generations")} in
                this line.
              </p>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              <SourceLink sourceId={flags[0].sourceId} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export function Assumptions({
  groups,
  onOverride,
  onUndo,
}: {
  groups: AssumptionGroups;
  onOverride: (personId: string, factId: FactId) => void;
  onUndo: (personId: string, factId: FactId) => void;
}) {
  const { decisive, confirmed, immaterial } = groups;
  if (decisive.length + confirmed.length + immaterial.length === 0) return null;

  return (
    <section aria-labelledby="assumptions" className="mt-12">
      <h2 id="assumptions" className="text-lg font-semibold tracking-tight">
        What this rests on
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Where a fact was not established, the tool used the ordinary answer and
        wrote it down here rather than hiding it. Everything in the first two
        lists would change your answer if it is wrong.
      </p>

      {decisive.length > 0 ? (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-subtle">
            Assumed, and carries the answer
          </h3>
          <ul className="mt-4 space-y-4">
            {decisive.map((assumption) => (
              <AssumptionItem
                key={keyOf(assumption)}
                assumption={assumption}
                badge="We assumed this"
                action={
                  assumption.factId === null ? null : (
                    <button
                      type="button"
                      onClick={() =>
                        onOverride(assumption.personId, assumption.factId as FactId)
                      }
                      className={buttonClasses("secondary", "mt-3 print:hidden")}
                    >
                      That is not right
                    </button>
                  )
                }
              />
            ))}
          </ul>
        </>
      ) : null}

      {confirmed.length > 0 ? (
        <>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-subtle">
            Confirmed by you, and carries the answer
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            You were shown these and left them standing. They are still
            assumptions rather than established facts, and the documents below
            would settle them.
          </p>
          <ul className="mt-4 space-y-4">
            {confirmed.map((assumption) => (
              <AssumptionItem
                key={keyOf(assumption)}
                assumption={assumption}
                badge="You confirmed this"
                action={
                  assumption.factId === null ? null : (
                    <button
                      type="button"
                      onClick={() =>
                        onUndo(assumption.personId, assumption.factId as FactId)
                      }
                      className={buttonClasses("secondary", "mt-3 print:hidden")}
                    >
                      Ask me about this again
                    </button>
                  )
                }
              />
            ))}
          </ul>
        </>
      ) : null}

      {immaterial.length > 0 ? (
        <details className="mt-8 break-inside-avoid rounded-lg border border-border bg-surface p-5">
          <summary className="cursor-pointer font-medium">
            Things assumed that did not change the answer (
            {immaterial.length})
          </summary>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            {immaterial.map((assumption) => (
              <li key={keyOf(assumption)}>{humaniseDates(assumption.statement)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function AssumptionItem({
  assumption,
  badge,
  action,
}: {
  assumption: Assumption;
  badge: string;
  action: React.ReactNode;
}) {
  return (
    <li className="break-inside-avoid rounded-lg border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-subtle">
        {badge}
      </p>
      <p className="mt-2 font-medium leading-7">{humaniseDates(assumption.statement)}</p>
      <p className="mt-2 leading-7 text-muted">{humaniseDates(assumption.why)}</p>
      {assumption.documents.length === 0 ? null : (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted">
            What would settle it
          </summary>
          <ul className="mt-2 ml-5 list-disc space-y-1 text-sm leading-6 text-muted">
            {assumption.documents.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </details>
      )}
      {action}
    </li>
  );
}

function keyOf(assumption: Assumption): string {
  return `${assumption.personId}:${assumption.factId ?? assumption.statement}`;
}

// ---------------------------------------------------------------------------
// Still unknown
// ---------------------------------------------------------------------------

export function StillUnknown({
  missing,
  onAnswerNow,
}: {
  missing: MissingFact[];
  onAnswerNow: (fact: MissingFact) => void;
}) {
  if (missing.length === 0) return null;

  return (
    <section aria-labelledby="unknown" className="mt-12">
      <h2 id="unknown" className="text-lg font-semibold tracking-tight">
        Still unknown
      </h2>
      <p className="mt-2 leading-7 text-muted">
        These have no safe default, so the tool declines to guess at them. Until
        one is settled, the generation it belongs to is not answerable rather
        than answered either way.
      </p>

      <ul className="mt-6 space-y-4">
        {missing.map((fact) => (
          <li
            key={`${fact.personId}:${fact.factId}`}
            className="break-inside-avoid rounded-lg border border-border p-5"
          >
            <p className="font-medium leading-7">{humaniseDates(fact.question)}</p>
            <p className="mt-2 leading-7 text-muted">{humaniseDates(fact.why)}</p>
            {fact.documents.length === 0 ? null : (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">
                  What would settle it
                </summary>
                <ul className="mt-2 ml-5 list-disc space-y-1 text-sm leading-6 text-muted">
                  {fact.documents.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
              </details>
            )}
            <button
              type="button"
              onClick={() => onAnswerNow(fact)}
              className={buttonClasses("secondary", "mt-3 print:hidden")}
            >
              Answer this now
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * The checklist. The most actionable thing on the page and the reason somebody
 * prints it.
 *
 * The boxes are visual only and are not saved. Persisting them would mean a
 * second storage key holding a record of which of a family's documents somebody
 * has been able to find, for the sake of a tick surviving a refresh.
 */
export function Checklist({ result }: { result: ChainResult }) {
  const groups = documentChecklist(result);
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="documents" className="mt-12">
      <h2 id="documents" className="text-lg font-semibold tracking-tight">
        Documents to gather
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Everything above that is assumed or unknown, turned into things to go
        and find, grouped by the person whose records they are. These are
        suggestions for someone working on their own, not a checklist IRCC
        publishes.
      </p>
      <p className="mt-2 text-sm leading-6 text-subtle print:hidden">
        The boxes are for reading on screen. They are not saved, on purpose: a
        record of which of your family&apos;s documents you have managed to find
        is not something this tool should be storing.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <div
            key={group.personId}
            className="break-inside-avoid rounded-lg border border-border p-5"
          >
            <h3 className="font-medium">{group.label}</h3>
            <ul className="mt-3 space-y-2">
              {group.documents.map((document) => (
                <li key={document}>
                  <label className="flex cursor-pointer gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
                    />
                    <span className="text-muted">{document}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

const EXPANDED: RuleTrace["kind"][] = ["matched", "barred"];

export function Reasoning({ result }: { result: ChainResult }) {
  return (
    <section aria-labelledby="reasoning" className="mt-12">
      <h2 id="reasoning" className="text-lg font-semibold tracking-tight">
        The reasoning, in full
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Every provision that was checked against every generation, and what it
        decided. Each line is written to be readable on its own, and to be
        pasted into a letter as it stands.
      </p>

      <div className="mt-6 space-y-8">
        {result.statuses.map((status) => {
          const shown = status.trace.filter((trace) =>
            EXPANDED.includes(trace.kind),
          );
          const rest = status.trace.filter(
            (trace) => !EXPANDED.includes(trace.kind),
          );
          return (
            <div key={status.personId} className="break-inside-avoid">
              <h3 className="font-medium">{status.label}</h3>
              {shown.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  No provision matched and none was barred.
                </p>
              ) : (
                <TraceList traces={shown} />
              )}
              {rest.length === 0 ? null : (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted">
                    Every provision that was checked ({rest.length})
                  </summary>
                  <TraceList traces={rest} />
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TraceList({ traces }: { traces: RuleTrace[] }) {
  return (
    <ul className="mt-3 space-y-3">
      {traces.map((trace, index) => (
        <li
          key={`${trace.provision}-${index}`}
          className="break-inside-avoid border-l-2 border-border pl-4 text-sm leading-6"
        >
          <p className="font-mono text-xs text-subtle">{trace.provision}</p>
          <p className="mt-1 text-muted">{humaniseDates(trace.because)}</p>
          <p className="mt-1 text-xs text-subtle">
            <SourceLink sourceId={trace.sourceId} />
          </p>
        </li>
      ))}
    </ul>
  );
}
