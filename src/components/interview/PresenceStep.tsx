"use client";

/**
 * Days of physical presence in Canada: an exact number, or nothing.
 *
 * There is deliberately **no** coarse "at least three years" choice that writes
 * 1,095. `fgl.ts` interpolates whatever number it is given verbatim into a
 * `because` string that is written to be pasted into a cover letter, so a
 * rounded figure the user never gave would end up quoted as fact in a document
 * destined for IRCC. Exact number or nothing.
 */

import { useId, useState } from "react";
import { Documents, FieldError, Legend, Why } from "./fields";
import { buttonClasses } from "@/components/button";
import { PRESENCE_DAYS } from "@/lib/c3/dates";
import { FACTS, documentsFor, questionFor } from "@/lib/c3/facts";
import { addressOf } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { formatNumber } from "@/lib/format";
import type { AnswerValue } from "@/lib/interview";

export function PresenceStep({
  line,
  person,
  onAnswer,
}: {
  line: LineDraft;
  person: PersonDraft;
  onAnswer: (value: AnswerValue) => void;
}) {
  const id = useId();
  const stated = person.facts.presenceDaysInCanada;
  const [days, setDays] = useState(stated === undefined ? "" : String(stated));
  const [submitted, setSubmitted] = useState(false);

  const value = days.trim() === "" ? null : Number(days);
  const invalid =
    value !== null && (!Number.isInteger(value) || value < 0 || value > 60000);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) return;
    if (value === null) return;
    onAnswer({ kind: "number", value });
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset aria-describedby={`${id}-why`}>
        <Legend>
          {questionFor("presenceDaysInCanada", addressOf(line, person))}
        </Legend>
        <Why id={`${id}-why`}>{FACTS.presenceDaysInCanada.why}</Why>

        <div className="mt-6">
          <label htmlFor={`${id}-days`} className="block text-sm font-medium">
            Total days
          </label>
          <p id={`${id}-hint`} className="mt-1 text-sm leading-6 text-muted">
            {formatNumber(PRESENCE_DAYS)} days is about three years. Give the
            real total if you have worked it out; do not round to the threshold,
            because the number you type is quoted back verbatim in the reasoning
            you may end up sending to IRCC.
          </p>
          <input
            id={`${id}-days`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={days}
            aria-describedby={`${id}-hint`}
            onChange={(event) =>
              setDays(event.target.value.replace(/[^0-9]/g, "").slice(0, 5))
            }
            className="mt-2 h-11 w-32 rounded-lg border border-border bg-background px-3 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          />
          {submitted && value === null ? (
            <FieldError>
              Enter a number, or choose &quot;I do not know yet&quot; below.
            </FieldError>
          ) : null}
          {invalid ? <FieldError>That is not a number of days.</FieldError> : null}
        </div>
      </fieldset>

      <Documents documents={documentsFor("presenceDaysInCanada")} />

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClasses("primary")}>
          Continue
        </button>
        <button
          type="button"
          onClick={() => onAnswer({ kind: "unknown" })}
          className={buttonClasses("secondary")}
        >
          I do not know yet
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Without a number this generation comes back as &quot;not answerable
        yet&quot; rather than as a yes or a no, and your result will name the
        documents that would settle it.
      </p>
    </form>
  );
}
