/**
 * The advisory layer: what the classification does not tell you.
 *
 * Two kinds of output. **Uncertainty flags** attach to a person and say that the
 * paragraph assigned rests on a contested reading or a judgment call.
 * **Advisories** attach to the chain and describe what IRCC is doing with files
 * like this one, which is not the same question as what the Act says.
 *
 * Both are reported separately from the classification, never folded into it.
 * Where the sources are withheld or contradictory the honest output is a flag,
 * not a quieter answer.
 */

import { AMEND_2009, AMEND_2015, CIF, isBefore } from "./dates";
import { PROCESSING_PAUSE_ORG_ID } from "./orgIds";
import type {
  Advisory,
  Paragraph,
  Person,
  Status,
  UncertaintyFlag,
} from "./types";

/** Paragraphs that are claims by descent rather than by birth in Canada. */
const BY_DESCENT: Paragraph[] = ["b", "g", "h", "o", "p", "q", "r"];

/**
 * The second excluded cohort, ATIP p. 155.
 *
 * "Although Bill C-3 added a citizenship despite the death of parent provision,
 * the way it is written may only apply when the deceased parent would have
 * become a citizen specifically as a result of the coming into force of Bill
 * C-3. Therefore, if the death occurred before April 17, 2009 or June 11, 2015
 * respectively the descendant may not have a claim by descent."
 *
 * Subsection 3(1.5) reaches a parent, or a parent and a grandparent, who
 * "would have been a citizen **as a result of the coming into force of that
 * Act**". An ancestor whose status was corrected by the 2009 or 2015 amendments
 * instead, and who died before those amendments, is not obviously inside it.
 */
export function deathCohortFlag(status: Status): UncertaintyFlag | null {
  if (status.deathDate === null) return null;
  const amendment =
    status.remediedBy === "c-37"
      ? { date: AMEND_2009, bill: "Bill C-37 (2009)" }
      : status.remediedBy === "c-24"
        ? { date: AMEND_2015, bill: "Bill C-24 (2015)" }
        : null;
  if (amendment === null) return null;
  if (!isBefore(status.deathDate, amendment.date)) return null;

  return {
    id: "cohort-2-death",
    personId: status.personId,
    title: `Died before ${amendment.bill} corrected their status`,
    detail: `${status.label} is a citizen under paragraph (${status.paragraph}) as a result of ${amendment.bill}, but died on ${status.deathDate}, before it came into force. IRCC's C-3 training material identifies this as a cohort that may have been unintentionally excluded, because subsection 3(1.5) is written to reach only ancestors who would have become citizens as a result of Bill C-3 itself. Those cases "are to be set aside until further operational instructions are given".`,
    sourceId: "atip-1a-2025-14201",
  };
}

/**
 * Subsection 3(1.5) reaches "their parent **or both their parent and their
 * parent's parent**". Two generations, and no further. A claim running through
 * three or more consecutive generations who all died before Bill C-3 came into
 * force is asking the provision to stretch past its own words.
 */
export function reachFlags(statuses: Status[]): UncertaintyFlag[] {
  const flags: UncertaintyFlag[] = [];
  let run: Status[] = [];

  const close = (next: Status | null) => {
    if (run.length > 2) {
      const subject = next ?? run[run.length - 1];
      flags.push({
        id: "s1_5-reach",
        personId: subject.personId,
        title: "The claim runs through more than two deceased generations",
        detail: `${run.length} consecutive generations in this line (${run
          .map((s) => s.label)
          .join(", ")}) died before Bill C-3 came into force on ${CIF}. Subsection 3(1.5) is written to reach "their parent or both their parent and their parent's parent". It says nothing about a third generation, and IRCC has published no guidance on one.`,
        sourceId: "citizenship-act",
      });
    }
    run = [];
  };

  for (const status of statuses) {
    if (status.deathDate !== null && isBefore(status.deathDate, CIF)) {
      run.push(status);
    } else {
      close(status);
    }
  }
  close(null);

  return flags;
}

/**
 * The processing pause, ATIP p. 157: a program bulletin dated 11 December 2025,
 * four days before Bill C-3 came into force.
 *
 * Five conditions, all of which must hold. The fifth is the one a family can do
 * something about, so it is surfaced as an action rather than buried in the
 * detail.
 */
export function processingPause(
  statuses: Status[],
  people: Person[],
): Advisory | null {
  const applicant = statuses[statuses.length - 1];
  if (applicant === undefined) return null;

  // 1. Claiming citizenship by descent.
  const byDescent =
    applicant.generationAbroad >= 1 &&
    applicant.paragraph !== null &&
    BY_DESCENT.includes(applicant.paragraph);
  if (!byDescent) return null;

  // 2. Born abroad beyond the first generation. 3. The 2009 first-generation
  // limit affects or affected them, which, for a person born abroad in the
  // second generation or later, is the same condition stated twice: that is
  // exactly who the 2009 limit excluded. They are kept separate here because
  // the bulletin states them separately.
  if (applicant.generationAbroad < 2) return null;

  // 4. The claim is predicated on a family member remedied through C-24 or C-37.
  const remedied = statuses.filter(
    (s) => s.remediedBy === "c-24" || s.remediedBy === "c-37",
  );
  if (remedied.length === 0) return null;

  // 5. No record that any such family member was issued a certificate.
  const withoutCertificate = remedied.filter(
    (s) => people.find((p) => p.id === s.personId)?.facts?.certificateIssued !== true,
  );
  if (withoutCertificate.length === 0) return null;

  const names = withoutCertificate.map((s) => s.label).join(", ");
  return {
    id: "processing-pause",
    title: "IRCC is not finalising applications like this one",
    detail: `A program bulletin dated 11 December 2025 tells officers not to finalise a proof of citizenship application where all of five things are true: the applicant claims citizenship by descent; is born abroad beyond the first generation; is affected by the 2009 first-generation limit; the claim rests on a family member who was or would have been remedied by Bill C-24 or C-37; and there is no record that a citizenship certificate was ever issued to that family member since. This chain matches all five, the family member in question is ${names}. Matching files are given ORG ID ${PROCESSING_PAUSE_ORG_ID}, a case note reading "Application on hold as per instructions from Program Guidance", and a Notice of Delay.`,
    action: `The last of the five conditions is the one you can change. If ${names} is living and applies for a citizenship certificate of their own, or if one was already issued and you can produce it, the conjunction breaks and the pause no longer describes the file.`,
    orgId: PROCESSING_PAUSE_ORG_ID,
    sourceId: "atip-1a-2025-14201",
    personIds: withoutCertificate.map((s) => s.personId),
  };
}

/** The first excluded cohort, restated at chain level so it leads the results. */
export function consecutiveCohortAdvisory(statuses: Status[]): Advisory | null {
  const hit = statuses.filter((s) =>
    s.flags.some((f) => f.id === "consecutive-q"),
  );
  if (hit.length === 0) return null;

  return {
    id: "excluded-cohort-consecutive-q",
    title: "IRCC has paused this exact situation",
    detail: `${hit
      .map((s) => `${s.label} is a (${s.paragraph}) whose parent is also a (${s.paragraph})`)
      .join("; ")}. IRCC's C-3 training material lists this as a cohort that "may not automatically become citizens by operation of law", and directs that the cases "are to be set aside" until further operational instructions are given. The internal guidance that would resolve it, the section headed "Recognition of a person as a Canadian citizen under paragraph 3(1)(q) where their Canadian parent is also a citizen under paragraph 3(1)(q)", is withheld from the release under section 23 of the Access to Information Act.`,
    sourceId: "atip-1a-2025-14201",
    personIds: hit.map((s) => s.personId),
  };
}

/** The second excluded cohort, restated at chain level. */
export function deathCohortAdvisory(statuses: Status[]): Advisory | null {
  const hit = statuses.filter((s) => s.flags.some((f) => f.id === "cohort-2-death"));
  if (hit.length === 0) return null;

  return {
    id: "excluded-cohort-death",
    title: "An ancestor this claim depends on died before the law reached them",
    detail: `${hit
      .map((s) => `${s.label} died on ${s.deathDate}`)
      .join("; ")}. Bill C-3's provision for a deceased ancestor, subsection 3(1.5), is written to reach only a parent or grandparent who would have become a citizen as a result of Bill C-3 itself, not one whose status was corrected by the 2009 or 2015 amendments and who died before those came into force. IRCC has identified this as an excluded cohort and is setting the cases aside.`,
    sourceId: "atip-1a-2025-14201",
    personIds: hit.map((s) => s.personId),
  };
}

export function buildAdvisories(statuses: Status[], people: Person[]): Advisory[] {
  return [
    consecutiveCohortAdvisory(statuses),
    deathCohortAdvisory(statuses),
    processingPause(statuses, people),
  ].filter((a): a is Advisory => a !== null);
}
