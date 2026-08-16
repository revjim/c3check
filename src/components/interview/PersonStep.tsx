"use client";

/**
 * The identity screen: who this person is, when and where they were born, and
 * whether they are still living.
 *
 * A deliberate exception to one question per screen. Those four things are one
 * coherent unit, the user has all of them in front of them at once, and
 * splitting a birth date away from a birthplace would mean visiting two screens
 * to copy one line of a certificate.
 */

import { useId, useState } from "react";
import { DateFields } from "./DateFields";
import { Fieldset, FieldError, Radio, RadioGroup, TextField } from "./fields";
import { buttonClasses } from "@/components/button";
import { NFLD_UNION } from "@/lib/c3/dates";
import type { BirthRegion } from "@/lib/c3";
import { defaultLabel, generationsBack, labelOf, midSentence } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { partsFromIso, readDateParts } from "@/lib/dateEntry";
import type { DateParts } from "@/lib/dateEntry";
import type { AnswerValue } from "@/lib/interview";
import { formatDate } from "@/lib/format";

const REGIONS: {
  value: BirthRegion;
  label: string;
  hint: string;
}[] = [
  {
    value: "canada",
    label: "In Canada",
    hint: "Any province or territory, at the time the birth happened.",
  },
  {
    value: "newfoundland",
    label: "In Newfoundland and Labrador",
    hint: `Kept separate because it has to be. Newfoundland did not join Confederation until ${formatDate(NFLD_UNION)}, so a birth there before that day was not a birth in Canada, and the Act routes it to an entirely different set of paragraphs. A birth there afterwards is simply a birth in Canada, and this tool works that out from the date.`,
  },
  {
    value: "outside",
    label: "Somewhere else",
    hint: "Anywhere outside Canada and outside pre-union Newfoundland.",
  },
];

export function PersonStep({
  line,
  person,
  onAnswer,
}: {
  line: LineDraft;
  person: PersonDraft;
  onAnswer: (value: AnswerValue) => void;
}) {
  const id = useId();
  const isApplicant = generationsBack(line, person.id) === 0;

  const [label, setLabel] = useState(person.label ?? "");
  const [birthParts, setBirthParts] = useState<DateParts>(
    partsFromIso(person.birthDate),
  );
  const [birthYearOnly, setBirthYearOnly] = useState(person.birthDateApproximate);
  const [region, setRegion] = useState<BirthRegion | null>(person.birthRegion);
  const [living, setLiving] = useState<boolean | null>(
    // Prefilled for the applicant, and visibly so, because the question reads
    // oddly addressed to the person filling the form and the answer is not in
    // any real doubt. Still a radio they can change.
    person.living ?? (isApplicant ? true : null),
  );
  const [deathParts, setDeathParts] = useState<DateParts>(
    partsFromIso(person.deathDate ?? ""),
  );
  const [deathYearOnly, setDeathYearOnly] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const birth = readDateParts(birthParts, birthYearOnly);
  const death = readDateParts(deathParts, deathYearOnly);

  const problems: string[] = [];
  if (birth.state !== "valid") problems.push("birth date");
  if (region === null) problems.push("place of birth");
  if (living === null) problems.push("whether they are still living");
  if (living === false && death.state === "invalid") problems.push("date of death");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    if (birth.state !== "valid" || region === null || living === null) return;

    onAnswer({
      kind: "person",
      patch: {
        label: label.trim() === "" ? null : label.trim(),
        birthDate: birth.iso,
        birthDateApproximate: birthYearOnly,
        birthRegion: region,
        living,
        deathDate: living === false && death.state === "valid" ? death.iso : null,
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-xl font-medium leading-8 text-balance">
        {isApplicant
          ? "Start with yourself"
          : `Tell us about ${midSentence(labelOf(line, person))}`}
      </h1>

      <div className="mt-8">
        <TextField
          id={`${id}-label`}
          label={isApplicant ? "What should we call you?" : "What do you call them?"}
          hint={
            isApplicant
              ? "Optional. Used only to label the rows in your result; it stays on this device."
              // The positional fallback, not the current label: this says what
              // happens if the box is emptied, and lowercasing whatever is in
              // it turns "Robert Fictional" into "robert fictional".
              : `Optional. A name or "Grandmother" is fine. Without one we will call them ${midSentence(defaultLabel(generationsBack(line, person.id)))}.`
          }
          value={label}
          onChange={setLabel}
          autoComplete="off"
          maxLength={60}
        />
      </div>

      <DateFields
        legend={isApplicant ? "When were you born?" : "When were they born?"}
        parts={birthParts}
        yearOnly={birthYearOnly}
        onParts={setBirthParts}
        onYearOnly={setBirthYearOnly}
        showError={submitted}
        required
      />

      <Fieldset
        legend={isApplicant ? "Where were you born?" : "Where were they born?"}
        className="mt-8"
      >
        <p className="mt-2 leading-7 text-muted">
          What matters is the legal status of the place on the day of the birth,
          which is a question about law rather than about geography. Pick what is
          true of the day itself; the tool works out the rest from the date.
        </p>
        <RadioGroup>
          {REGIONS.map((option) => (
            <Radio
              key={option.value}
              name={`${id}-region`}
              value={option.value}
              checked={region === option.value}
              onChange={() => setRegion(option.value)}
              label={option.label}
              hint={option.hint}
            />
          ))}
        </RadioGroup>
        {submitted && region === null ? (
          <FieldError>Choose where the birth happened.</FieldError>
        ) : null}
      </Fieldset>

      <Fieldset
        legend={isApplicant ? "Are you still living?" : "Are they still living?"}
        className="mt-8"
      >
        <p className="mt-2 leading-7 text-muted">
          Several paragraphs describe someone&apos;s status <em>on</em> a
          particular day, 1 January 1947 or 1 April 1949, which someone who had
          already died cannot have had. It can decide a paragraph outright.
        </p>
        <RadioGroup>
          <Radio
            name={`${id}-living`}
            value="living"
            checked={living === true}
            onChange={() => setLiving(true)}
            label="Still living"
          />
          <Radio
            name={`${id}-living`}
            value="died"
            checked={living === false}
            onChange={() => setLiving(false)}
            label="They have died"
          />
        </RadioGroup>
        {submitted && living === null ? (
          <FieldError>Choose one.</FieldError>
        ) : null}

        {living === false ? (
          <>
            <DateFields
              legend="When did they die?"
              parts={deathParts}
              yearOnly={deathYearOnly}
              onParts={setDeathParts}
              onYearOnly={setDeathYearOnly}
              showError={false}
              required={false}
            />
            <p className="mt-2 text-sm leading-6 text-muted">
              Leave this blank if you do not know. The tool will then have to
              assume they were still alive on every date the Act turns on, and
              it will say so on your result rather than quietly proceeding.
            </p>
          </>
        ) : null}
      </Fieldset>

      {person.gedcom === undefined ? null : (
        <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-muted">
          Some of this was read from the file you uploaded
          {person.gedcom.placeText === undefined ? null : (
            <>
              {" "}
              (place recorded as{" "}
              <span className="font-mono">{person.gedcom.placeText}</span>)
            </>
          )}
          {person.gedcom.dateText === undefined ? null : (
            <>
              {" "}
              (date recorded as{" "}
              <span className="font-mono">{person.gedcom.dateText}</span>)
            </>
          )}
          . Check it before going on: a place written into a family tree decades
          later is a guess about geography, and this needs the legal status of
          the place at the date.
        </p>
      )}

      <div className="mt-10">
        <button type="submit" className={buttonClasses("primary")}>
          Continue
        </button>
        {submitted && problems.length > 0 ? (
          <FieldError>
            Still needed: {problems.join(", ")}.
          </FieldError>
        ) : null}
      </div>
    </form>
  );
}
