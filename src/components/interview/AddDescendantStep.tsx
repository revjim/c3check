"use client";

/**
 * "Is there anyone after them?"
 *
 * The mirror of `AddAncestorStep`, and the question most people came here with.
 * A line is a chain that contains you rather than a list of your ancestors, so
 * once the backward walk has reached someone born in Canada the same chain can
 * be extended forward, and the engine classifies a child exactly as it
 * classifies a parent: from the entry before them.
 *
 * Two choices rather than four. There is no mother-and-father fork to offer,
 * because a child has one place in this line and the engine does not model sex;
 * see the note on `ParentKind` in `src/lib/draft.ts`.
 */

import { useId, useState } from "react";
import { FieldError, Legend, Radio, RadioGroup, Why } from "./fields";
import { buttonClasses } from "@/components/button";
import { addressOf, midSentence } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { possessive } from "@/lib/interview";
import type { AnswerValue } from "@/lib/interview";

type Choice = "child" | "none";

export function AddDescendantStep({
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
    line.noLaterDescendant ? "none" : null,
  );
  const [submitted, setSubmitted] = useState(false);
  const who = midSentence(addressOf(line, person));
  const you = who === "you";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (choice === null) return;
    onAnswer(
      choice === "none"
        ? { kind: "no-later-descendant" }
        : { kind: "add-descendant" },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset aria-describedby={`${id}-why`}>
        <Legend>
          {you ? "Do you have children?" : `Does ${who} have children?`}
        </Legend>
        <Why id={`${id}-why`}>
          A child born outside Canada is classified under a paragraph of their
          own, and it is not always the same one as their parent. For a birth
          since Bill C-3 came into force it can also turn on how many days the
          citizen parent spent in Canada before the birth, which is a question
          about the parent that only a child can make relevant.
        </Why>
        <p className="mt-3 leading-7 text-muted">
          Add one at a time, the same way the line was built going back. Your own
          answer does not change: the result stays about you, and each person
          added gets their own row and their own paragraph.
        </p>

        <RadioGroup>
          <Radio
            name={id}
            value="child"
            checked={choice === "child"}
            onChange={() => setChoice("child")}
            label="Add a child"
            hint={
              you
                ? "One of your children. You can add another afterwards, and their children after that."
                : `One of ${possessive(who)} children. You can add another afterwards, and their children after that.`
            }
          />
          <Radio
            name={id}
            value="none"
            checked={choice === "none"}
            onChange={() => setChoice("none")}
            label="No one after them"
            hint="Or nobody you want an answer for. You can come back and add someone later without losing anything."
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
