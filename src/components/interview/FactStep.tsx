"use client";

/**
 * One fact, one screen.
 *
 * "I do not know yet" **deletes** the fact rather than writing `false`. For a
 * fact with no safe default that leaves the person `undetermined`, which is the
 * honest state and is what the screen says out loud: a tool that turned "I do
 * not know" into "no" would be inventing the answer in the one direction that
 * makes someone stop looking.
 */

import { useId, useState } from "react";
import { Documents, FieldError, Legend, Radio, RadioGroup, Why } from "./fields";
import { buttonClasses } from "@/components/button";
import { FACTS, documentsFor, questionFor } from "@/lib/c3/facts";
import type { FactId } from "@/lib/c3";
import { addressOf, midSentence } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { possessive } from "@/lib/interview";
import type { AnswerValue } from "@/lib/interview";

type Choice = "yes" | "no" | "unknown";

export function FactStep({
  line,
  person,
  factId,
  onAnswer,
}: {
  line: LineDraft;
  person: PersonDraft;
  factId: FactId;
  onAnswer: (value: AnswerValue) => void;
}) {
  const id = useId();
  const stated = person.facts[factId];
  const [choice, setChoice] = useState<Choice | null>(
    stated === true
      ? "yes"
      : stated === false
        ? "no"
        : person.answered.includes(factId)
          ? "unknown"
          : null,
  );
  const [submitted, setSubmitted] = useState(false);

  const who = addressOf(line, person);
  const entry = FACTS[factId];
  const hasDefault = entry.defaultWhenUnasked !== undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (choice === null) return;
    onAnswer(
      choice === "unknown"
        ? { kind: "unknown" }
        : { kind: "boolean", value: choice === "yes" },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset aria-describedby={`${id}-why`}>
        <Legend>{questionFor(factId, who)}</Legend>
        <Why id={`${id}-why`}>{entry.why}</Why>

        <RadioGroup>
          <Radio
            name={id}
            value="yes"
            checked={choice === "yes"}
            onChange={() => setChoice("yes")}
            label="Yes"
          />
          <Radio
            name={id}
            value="no"
            checked={choice === "no"}
            onChange={() => setChoice("no")}
            label="No"
          />
          <Radio
            name={id}
            value="unknown"
            checked={choice === "unknown"}
            onChange={() => setChoice("unknown")}
            label="I do not know yet"
            hint={
              hasDefault
                ? "We will carry on using the ordinary assumption and list it on your result, where you can change it."
                : `There is no safe assumption for this one, so ${possessive(midSentence(who))} generation will come back as "not answerable yet" rather than as a yes or a no. Your result will name it and the documents that would settle it, and you can come back to it.`
            }
          />
        </RadioGroup>
        {submitted && choice === null ? (
          <FieldError>Choose one, including &quot;I do not know yet&quot;.</FieldError>
        ) : null}
      </fieldset>

      <Documents documents={documentsFor(factId)} />

      <div className="mt-8">
        <button type="submit" className={buttonClasses("primary")}>
          Continue
        </button>
      </div>
    </form>
  );
}
