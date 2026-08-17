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
 *
 * **Coming back to the screen shows the same list, not an empty one.** The
 * screen used to hide anything already in `acceptedDefaults`, which is right
 * once and wrong forever after: having said "none of these happened", the whole
 * list vanished, and a user returning to correct one of them was told there was
 * nothing here to confirm. `acceptedDefaults` is what stops the interview
 * *putting* the screen again, which is a different thing from what the screen
 * shows when someone asks for it.
 */

import { useId, useState } from "react";
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
  // Every box starts clear, on a first visit and on a return alike. Ticking one
  // sets the fact, and a fact is no longer an assumption, so a corrected item
  // leaves this list altogether and is edited from its own screen in the trail.
  // Nothing that is still here has ever been ticked.
  const [corrections, setCorrections] = useState<Record<string, boolean>>({});

  const who = midSentence(addressOf(line, person));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const confirmations: Confirmation[] = assumptions.map((assumption) => {
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

  if (assumptions.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-medium leading-8 text-balance">
          Nothing is being assumed about {who}
        </h1>
        <p className="mt-4 leading-7 text-muted">
          There were things to confirm here, and an answer you have given since
          has settled all of them. Anything the result still rests on is listed
          on the result itself, where it can be changed.
        </p>
        <div className="mt-8">
          <button
            type="button"
            onClick={() => onAnswer({ kind: "confirm", confirmations: [] })}
            className={buttonClasses("primary")}
          >
            Carry on
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-xl font-medium leading-8 text-balance">
        Things we assumed about {who}
      </h1>

      <p className="mt-4 leading-7 text-muted">
        {assumptions.length === 1
          ? "We assumed one thing here, and it carries the whole answer."
          : `We assumed ${plural(assumptions.length, "thing", "things")} here, and each one of them would change your answer if we have it wrong.`}{" "}
        Every one of these is rare, which is why the tool assumes it did not
        happen. Tick anything that did.
      </p>

      <ul className="mt-8 space-y-3">
        {assumptions.map((assumption) => {
          const factId = assumption.factId as FactId;
          const checked = corrections[factId] === true;
          const settled = person.acceptedDefaults.includes(factId);
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
                {settled ? (
                  <span className="col-start-2 text-xs font-semibold uppercase tracking-widest text-subtle">
                    You left this standing
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <button type="submit" className={buttonClasses("primary")}>
          {Object.values(corrections).some(Boolean)
            ? "Save these corrections"
            : "None of these happened"}
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        Leaving one alone does not turn it into an established fact. Your result
        will still list it as an assumption, marked as one you confirmed, with
        the documents that would settle it.
      </p>
    </form>
  );
}
