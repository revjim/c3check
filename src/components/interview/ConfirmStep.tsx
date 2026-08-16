"use client";

/**
 * The confirm pass: everything assumed about one person that carries the
 * answer, on one screen.
 *
 * See `confirmSteps` in `src/lib/interview.ts` for why this is per person
 * rather than one screen per assumption. In short: three of the defaulted facts
 * halt the chain when inverted, so they come out decisive for every person in
 * every chain, and asking them one screen at a time would make a
 * five-generation line twenty screens long.
 *
 * Leaving an item alone does **not** set the fact. The engine goes on reporting
 * it as an assumption, honestly, and the results page badges it "you confirmed
 * this" rather than "we assumed this". That distinction is worth having, and it
 * is also what makes this pass terminate.
 */

import { useId, useState } from "react";
import { FieldError } from "./fields";
import { buttonClasses } from "@/components/button";
import type { Assumption, FactId } from "@/lib/c3";
import { questionFor } from "@/lib/c3/facts";
import { addressOf, midSentence } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { plural } from "@/lib/format";
import type { AnswerValue, Confirmation } from "@/lib/interview";

export function ConfirmStep({
  line,
  person,
  assumptions,
  onAnswer,
}: {
  line: LineDraft;
  person: PersonDraft;
  assumptions: Assumption[];
  onAnswer: (value: AnswerValue) => void;
}) {
  const id = useId();
  const outstanding = assumptions.filter(
    (assumption) =>
      !person.acceptedDefaults.includes(assumption.factId as FactId),
  );
  const [corrections, setCorrections] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const who = midSentence(addressOf(line, person));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const confirmations: Confirmation[] = outstanding.map((assumption) => {
      const factId = assumption.factId as FactId;
      return {
        factId,
        // Undefined means the user left it alone, which is a decision to keep
        // the assumption rather than an answer to the question.
        correction: corrections[factId] ?? null,
      };
    });
    onAnswer({ kind: "confirm", confirmations });
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-xl font-medium leading-8 text-balance">
        Things we assumed about {who}
      </h1>

      <p className="mt-4 leading-7 text-muted">
        {outstanding.length === 1
          ? "We assumed one thing here, and it carries the whole answer."
          : `We assumed ${plural(outstanding.length, "thing", "things")} here, and each one of them would change your answer if we have it wrong.`}{" "}
        Every one of these is rare, which is why the tool assumes it did not
        happen. Tick anything that did.
      </p>

      <ul className="mt-8 space-y-3">
        {outstanding.map((assumption) => {
          const factId = assumption.factId as FactId;
          const checked = corrections[factId] === true;
          return (
            <li key={factId}>
              {/* Grid rather than nested spans so the accessible text sits as
                  a direct child of the label; jsx-a11y stops seeing it below
                  two levels, and so, in practice, do some screen readers. */}
              <label className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border p-4 leading-6 transition-colors has-checked:border-brand has-checked:bg-brand/5 hover:bg-surface">
                <input
                  type="checkbox"
                  name={`${id}-${factId}`}
                  checked={checked}
                  onChange={(event) =>
                    setCorrections((current) => ({
                      ...current,
                      [factId]: event.target.checked,
                    }))
                  }
                  className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
                />
                <span className="font-medium">
                  {questionFor(factId, who)}
                </span>
                <span className="col-start-2 text-sm leading-6 text-muted">
                  We assumed not. {assumption.why}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {outstanding.length === 0 ? (
        <p className="mt-8 leading-7 text-muted">
          Nothing left to confirm here.
        </p>
      ) : null}

      <div className="mt-8">
        <button type="submit" className={buttonClasses("primary")}>
          {Object.values(corrections).some(Boolean)
            ? "Save these corrections"
            : "None of these happened"}
        </button>
        {submitted ? <FieldError>{null}</FieldError> : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Leaving one alone does not turn it into an established fact. Your result
        will still list it as an assumption, marked as one you confirmed, with
        the documents that would settle it.
      </p>
    </form>
  );
}
