"use client";

/**
 * "Who was their parent?"
 *
 * This tool follows one line at a time, because the Act is written as a chain:
 * each generation's paragraph depends on the one before it, and a tree has no
 * single answer to give. So the screen says so plainly and asks the user to
 * pick the parent more likely to reach Canada, with the promise that the other
 * one can be tried afterwards.
 *
 * Mother and father are labels only. The engine does not model sex at all; see
 * the note on `ParentKind` in `src/lib/draft.ts`.
 */

import { useId, useState } from "react";
import { FieldError, Legend, Radio, RadioGroup, Why } from "./fields";
import { buttonClasses } from "@/components/button";
import { addressOf, midSentence } from "@/lib/draft";
import type { LineDraft, ParentKind, PersonDraft } from "@/lib/draft";
import { possessive } from "@/lib/interview";
import type { AnswerValue } from "@/lib/interview";

type Choice = ParentKind | "none";

/** A label that opens a radio, so it starts a sentence rather than joining one. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AddAncestorStep({
  line,
  person,
  onAnswer,
}: {
  line: LineDraft;
  person: PersonDraft;
  onAnswer: (value: AnswerValue) => void;
}) {
  const id = useId();
  const [choice, setChoice] = useState<Choice | null>(
    line.noEarlierAncestor ? "none" : null,
  );
  const [submitted, setSubmitted] = useState(false);
  const who = midSentence(addressOf(line, person));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (choice === null) return;
    onAnswer(
      choice === "none"
        ? { kind: "no-earlier-ancestor" }
        : { kind: "add-ancestor", parent: choice },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset aria-describedby={`${id}-why`}>
        <Legend>Who was {possessive(who)} parent?</Legend>
        <Why id={`${id}-why`}>
          Nobody in this line was born in Canada, or in Newfoundland and
          Labrador before it joined Confederation, so there is no ancestor to
          reason from yet. Every route to citizenship by descent begins with
          someone who was there.
        </Why>
        <p className="mt-3 leading-7 text-muted">
          This tool follows one parent at a time, because each generation&apos;s
          paragraph depends on the one before it. Pick whichever parent is more
          likely to reach Canada. You can try the other one afterwards, and
          compare the two.
        </p>

        <RadioGroup>
          <Radio
            name={id}
            value="mother"
            checked={choice === "mother"}
            onChange={() => setChoice("mother")}
            label={`${capitalise(possessive(who))} mother`}
          />
          <Radio
            name={id}
            value="father"
            checked={choice === "father"}
            onChange={() => setChoice("father")}
            label={`${capitalise(possessive(who))} father`}
          />
          <Radio
            name={id}
            value="parent"
            checked={choice === "parent"}
            onChange={() => setChoice("parent")}
            label="A parent, and it does not matter which"
            hint="Nothing in section 3 turns on which parent it was; this only changes what the row is called."
          />
          <Radio
            name={id}
            value="none"
            checked={choice === "none"}
            onChange={() => setChoice("none")}
            label="I do not know who their parent was"
            hint="The line ends here. Your result will say that no one in it was born in Canada, and name the records that would find someone who was."
          />
        </RadioGroup>
        {submitted && choice === null ? (
          <FieldError>Choose one.</FieldError>
        ) : null}
      </fieldset>

      <div className="mt-8">
        <button type="submit" className={buttonClasses("primary")}>
          Continue
        </button>
      </div>
    </form>
  );
}
