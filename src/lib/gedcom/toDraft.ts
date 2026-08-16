/**
 * Turning a chosen line out of a family tree into a saved interview.
 *
 * **A GEDCOM prefills the form. It never completes it.** Every person copied
 * across carries `gedcom.confirmed: false`, which `isCompletePerson` treats as
 * incomplete, so the identity screen is visited for every generation whatever
 * the file said. That is not caution for its own sake: a `PLAC` is whatever a
 * relative typed decades later, and `resolvePlace` needs the legal status of a
 * place on the day of the birth, which is a question about law rather than
 * about geography.
 *
 * The preview is the other half. Rather than scoring legal merit in the ranker,
 * which would be a second and worse copy of the statute, the caller runs the
 * real engine over the best few paths with no facts supplied and shows what each
 * one currently yields. That turns a ranking from a guess into a preview.
 */

import { classifyChain } from "@/lib/c3";
import type { ChainResult, Person } from "@/lib/c3";
import { newLine, newPerson } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import { birthDateOf, birthPlaceOf } from "./parse";
import type { GedcomFile, GedcomIndividual } from "./parse";
import type { AncestralPath, PathStep } from "./paths";
import { guessBirthRegion } from "./places";

/**
 * The line as a draft, ready for the interview.
 *
 * Ids run applicant-first in the numbering (`p1` is the applicant) while the
 * array runs anchor-first, matching the rest of the draft layer: the array
 * order is engine order and the numbering is the order the user thinks in.
 */
export function lineFromPath(
  file: GedcomFile,
  path: AncestralPath,
  lineId: string,
  name: string,
): LineDraft {
  const people: PersonDraft[] = path.steps.map((step, index) => {
    // The last step is the applicant, so numbering counts back from the end.
    const sequence = path.steps.length - index;
    return personFromStep(file, step, `p${sequence}`);
  });

  return {
    ...newLine(lineId, name),
    people,
    nextPersonSeq: path.steps.length + 1,
  };
}

function personFromStep(
  file: GedcomFile,
  step: PathStep,
  id: string,
): PersonDraft {
  const base = newPerson(id, "gedcom");
  const person = file.individuals.get(step.xref);
  if (person === undefined) {
    return { ...base, gedcom: { xref: step.xref, confirmed: false } };
  }

  const birth = birthDateOf(person);
  const place = birthPlaceOf(person);
  const guess = place === null ? null : guessBirthRegion(place.place);
  const death = person.death?.date ?? null;

  return {
    ...base,
    label: person.name,
    birthDate:
      birth === null || birth.date.kind === "unparsed" ? "" : birth.date.iso,
    birthDateApproximate: birth?.date.kind === "approximate",
    birthRegion: guess?.region ?? null,
    // Never guessed from the absence of a death record. "No DEAT tag" means the
    // file does not say, and the interview asks.
    living: death === null && person.death === null ? null : false,
    deathDate: death !== null && death.kind !== "unparsed" ? death.iso : null,
    gedcom: {
      xref: step.xref,
      ...(place !== null ? { placeText: place.place } : {}),
      ...(birth !== null ? { dateText: birth.date.text } : {}),
      confirmed: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export type Preview =
  | { kind: "ready"; result: ChainResult }
  /** Not enough in the file to run anything, and which people are the reason. */
  | { kind: "blocked"; missingDates: string[] };

/**
 * What this line currently yields, run through the real engine.
 *
 * No facts are supplied, so the answer is what the dates and places alone
 * produce; almost every line comes back `undetermined` or `incomplete`, and
 * that is the honest preview. `assessAssumptions: false` because the caller is
 * previewing five lines at once and nothing here reads the assumption list.
 */
export function previewPath(file: GedcomFile, path: AncestralPath): Preview {
  const missingDates: string[] = [];
  const chain: Person[] = [];

  for (const step of path.steps) {
    const person = file.individuals.get(step.xref);
    const birth = person === undefined ? null : birthDateOf(person);
    if (person === undefined || birth === null || birth.date.kind === "unparsed") {
      missingDates.push(nameOf(person, step.xref));
      continue;
    }
    const place = birthPlaceOf(person);
    chain.push({
      id: step.xref,
      label: person.name ?? step.xref,
      birthDate: birth.date.iso,
      birthRegion:
        place === null ? "outside" : (guessBirthRegion(place.place).region ?? "outside"),
      ...(person.death?.date != null && person.death.date.kind !== "unparsed"
        ? { deathDate: person.death.date.iso }
        : {}),
    });
  }

  if (missingDates.length > 0 || chain.length === 0) {
    return { kind: "blocked", missingDates };
  }
  return {
    kind: "ready",
    result: classifyChain(chain, { assessAssumptions: false }),
  };
}

function nameOf(person: GedcomIndividual | undefined, xref: string): string {
  return person?.name ?? xref;
}

/** One sentence about what a suggested line currently amounts to. */
export function describePreview(preview: Preview): string {
  if (preview.kind === "blocked") {
    const names = preview.missingDates.slice(0, 3).join(", ");
    return preview.missingDates.length === 0
      ? "There is nobody in this line to work from."
      : `Your file has no readable birth date for ${names}${
          preview.missingDates.length > 3 ? ", among others" : ""
        }, so this cannot be worked out until you supply one.`;
  }

  const { headline, missing } = preview.result;
  const outstanding =
    missing.length === 0
      ? "nothing further to establish"
      : `${missing.length} question${missing.length === 1 ? "" : "s"} to answer`;

  switch (headline.verdict) {
    case "qualifies":
      return `On the dates and places in your file alone, this line already reaches paragraph 3(1)(${headline.paragraph ?? "?"}); ${outstanding}.`;
    case "undetermined":
      return `This line reaches an ancestor the Act can work from; ${outstanding}.`;
    case "incomplete":
      return "Nobody in this line was born in Canada, or in Newfoundland and Labrador before the union, so it has no anchor yet.";
    case "fails":
      return `On the dates and places in your file alone, no paragraph describes this line; ${outstanding}.`;
    case "stopped":
      return "This line contains something the tool declines to model without asking you first.";
  }
}
