/**
 * What to ask next.
 *
 * There is no precomputed question list and there cannot be one, because
 * `result.missing` is already materiality-filtered: only facts that could still
 * outrank the current winner survive `classify.ts`, and that filter is dynamic.
 * Answering `livedInCanadaOrNewfoundland: true` unlocks three facts that did not
 * exist in the queue a moment earlier. So the queue is recomputed after every
 * answer, and there is no honest percentage to show.
 *
 * The queue does keep questions that have already been answered, rather than
 * dropping them. That is what lets `?step=N` be a real index and lets Back show
 * a previous question with its answer still selected. "Resolved" means the
 * interview has put the question, not that the engine is satisfied by the
 * answer: someone who says "I do not know yet" has resolved the step and left
 * the fact missing, and both of those are true at once.
 *
 * Pure. Every decision the interview makes is in this file so that the
 * components are a `switch (step.kind)` over some JSX.
 */

import { FACTS, questionFor } from "@/lib/c3/facts";
import type { Assumption, ChainResult, FactId } from "@/lib/c3";
import {
  acceptDefault,
  addAncestor,
  addressOf,
  anchorOf,
  applicantOf,
  classifyLine,
  clearFact,
  confirmGedcom,
  isCompletePerson,
  midSentence,
  needsAncestor,
  personById,
  sentenceStart,
  setFact,
  setNoEarlierAncestor,
  setPendingEdit,
  updatePerson,
} from "@/lib/draft";
import type { LineDraft, ParentKind, PersonDraft, StepRef } from "@/lib/draft";
import { plural } from "@/lib/format";

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type Step =
  | { kind: "person"; personId: string }
  | { kind: "fact"; personId: string; factId: FactId }
  /** One screen per person, carrying every decisive assumption about them. */
  | { kind: "confirm"; personId: string }
  | { kind: "add-ancestor"; childId: string }
  | { kind: "done" };

export type PlannedStep = {
  step: Step;
  /** The question has been put and answered, whatever the answer was. */
  resolved: boolean;
};

export const DONE: Step = { kind: "done" };

/** A stable string for React keys and for comparing two steps. */
export function stepKey(step: Step): string {
  switch (step.kind) {
    case "person":
      return `person:${step.personId}`;
    case "fact":
      return `fact:${step.personId}:${step.factId}`;
    case "confirm":
      return `confirm:${step.personId}`;
    case "add-ancestor":
      return `add-ancestor:${step.childId}`;
    case "done":
      return "done";
  }
}

export function sameStep(a: Step, b: Step): boolean {
  return stepKey(a) === stepKey(b);
}

/** A stored `StepRef` is a `Step` without the terminal case. */
export function stepFromRef(ref: StepRef): Step {
  return ref;
}

export function stepToRef(step: Step): StepRef | null {
  return step.kind === "done" ? null : step;
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

/**
 * The whole queue, resolved and unresolved, in the order it is presented.
 *
 * Four phases:
 *
 * 1. **Identity, anchor first.** One screen per person. Identity for *everyone*
 *    precedes facts for *anyone*, because materiality is computed over the whole
 *    chain: an ancestor added above can retire the facts you were about to ask
 *    below. It is also a hard requirement rather than a preference, since the
 *    engine cannot be run at all until every birth date parses.
 * 2. **Facts.** Answered ones first, in the order they were asked, then whatever
 *    the engine still reports as missing. `result.missing` is built from a
 *    `Set<FactId>` in rule-evaluation order and flattened over `statuses`, so it
 *    is already grouped by person anchor-first; grouping it by person here
 *    preserves that order rather than imposing a new one.
 * 3. **Another generation**, where the line has no anchor yet.
 * 4. **The confirm pass**, but only once 1 to 3 have nothing outstanding.
 *
 * A halted chain returns nothing at all: there is no further question worth
 * asking, and the results page carries the reason.
 */
export function stepPlan(line: LineDraft): PlannedStep[] {
  const identity: PlannedStep[] = line.people.map((person) => ({
    step: { kind: "person", personId: person.id },
    resolved: isCompletePerson(person),
  }));

  if (identity.some((planned) => !planned.resolved)) return identity;

  // Cheap mode: the confirm pass and the results page are the only places that
  // want the default, which re-runs the whole chain once per boolean default.
  const result = classifyLine(line, { assessAssumptions: false });
  if (result === null) return identity;
  if (result.applicant.outcome === "stopped") return identity;

  const plan = [...identity, ...factSteps(line, result), ...ancestorStep(line)];
  if (plan.some((planned) => !planned.resolved)) return plan;

  return [...plan, ...confirmSteps(line)];
}

function factSteps(line: LineDraft, result: ChainResult): PlannedStep[] {
  const steps: PlannedStep[] = [];
  for (const person of line.people) {
    for (const factId of person.answered) {
      steps.push({ step: { kind: "fact", personId: person.id, factId }, resolved: true });
    }
    for (const missing of result.missing) {
      if (missing.personId !== person.id) continue;
      if (person.answered.includes(missing.factId)) continue;
      steps.push({
        step: { kind: "fact", personId: person.id, factId: missing.factId },
        resolved: false,
      });
    }
  }
  return steps;
}

function ancestorStep(line: LineDraft): PlannedStep[] {
  const top = anchorOf(line);
  if (top === null) return [];
  // Kept in the queue after "I do not know who their parent was" so the answer
  // can be revisited; dropped entirely once the line reaches an anchor, because
  // then there is genuinely nothing further back to ask about.
  if (!needsAncestor(line) && !line.noEarlierAncestor) return [];
  return [
    {
      step: { kind: "add-ancestor", childId: top.id },
      resolved: line.noEarlierAncestor,
    },
  ];
}

/**
 * The confirm pass: one screen per person, listing every assumption about them
 * that carries the answer.
 *
 * **Why per person and not per assumption.** The obvious design is one yes/no
 * screen per decisive assumption, on the expectation that there will be one to
 * three of them. There are not. Three of the thirteen defaulted facts,
 * `adopted`, `lostAndRestored` and `citizenshipByGrant`, are detect-and-stop
 * conditions, so inverting any of them turns the applicant's outcome into
 * `stopped`, and `markDecisiveAssumptions` counts a changed outcome as
 * decisive. They therefore come out decisive for **every person in every
 * chain**. Measured against the fixtures: twenty decisive assumptions for the
 * five-generation `gcmsChain`, six for the two-generation `modernAnchorChain`.
 *
 * Dropping them would be worse than asking: an adoption anywhere in a line
 * genuinely voids the whole analysis, and it is exactly the thing worth
 * confirming before someone acts on a result. So they are all asked, gathered
 * onto one screen per generation, which puts a five-generation chain back at
 * five screens rather than twenty.
 *
 * An assumption with `decisive === undefined` is always the aliveness one in
 * practice, since `invertFact` returns null only for a non-boolean default and
 * all thirteen defaulted facts default to `false`. It has no single inverse to
 * test, so it is offered on the results page as "add a date of death" rather
 * than as a yes/no here.
 *
 * **Why this terminates.** Answering "yes" to an item sets the fact, which can
 * open new missing facts and send the queue back to phase 2, which is a genuine
 * cycle risk. It is closed by `acceptedDefaults`: leaving an item alone records
 * the fact id there *without setting the fact*, so the engine goes on reporting
 * it honestly as an assumption while the interview never puts it again. Every
 * submission therefore removes at least one (person, fact) pair from the pool
 * permanently, and the pool is bounded at eighteen facts times the number of
 * generations.
 */
function confirmSteps(line: LineDraft): PlannedStep[] {
  const result = classifyLine(line);
  if (result === null) return [];
  return line.people.flatMap((person) => {
    const pending = pendingConfirmations(result, person);
    if (pending.length === 0) return [];
    return [
      {
        step: { kind: "confirm", personId: person.id } satisfies Step,
        resolved: pending.every((assumption) =>
          person.acceptedDefaults.includes(assumption.factId as FactId),
        ),
      },
    ];
  });
}

/** The assumptions worth putting to the user, in chain order. */
export function decisiveAssumptions(result: ChainResult): Assumption[] {
  return result.assumptions.filter(
    (assumption) => assumption.decisive === true && assumption.factId !== null,
  );
}

/** The decisive assumptions about one person, whether or not already accepted. */
function pendingConfirmations(
  result: ChainResult,
  person: PersonDraft,
): Assumption[] {
  return decisiveAssumptions(result).filter(
    (assumption) => assumption.personId === person.id,
  );
}

export function stepQueue(line: LineDraft): Step[] {
  return stepPlan(line).map((planned) => planned.step);
}

/** The first unresolved position, or the queue length once nothing is left. */
export function currentIndex(line: LineDraft): number {
  const plan = stepPlan(line);
  const index = plan.findIndex((planned) => !planned.resolved);
  return index === -1 ? plan.length : index;
}

/** A clamped lookup. Out of range, or an empty queue, means the interview is done. */
export function stepAt(line: LineDraft, index: number): Step {
  const queue = stepQueue(line);
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
    return DONE;
  }
  return queue[index];
}

/**
 * Where to go next.
 *
 * A pending edit set by "change this answer" on the results page comes first.
 * That is stored on the line rather than done as URL surgery, because ordinals
 * are unstable across queue changes and a link built from one would rot.
 */
export function nextStep(line: LineDraft): Step {
  if (line.pendingEdit !== null) return stepFromRef(line.pendingEdit);
  return stepAt(line, currentIndex(line));
}

/**
 * The index to move to after answering the step at `from`.
 *
 * Continues from where the user is rather than jumping: the first unresolved
 * step at or after `from`, falling back to the frontier when everything from
 * there on is answered, which is what happens when an earlier answer is edited.
 */
export function advanceFrom(line: LineDraft, from: number): number {
  const plan = stepPlan(line);
  for (let i = Math.max(0, from); i < plan.length; i++) {
    if (!plan[i].resolved) return i;
  }
  return currentIndex(line);
}

/** True when there is nothing left worth asking. */
export function isDone(line: LineDraft): boolean {
  return nextStep(line).kind === "done";
}

// ---------------------------------------------------------------------------
// Question text
// ---------------------------------------------------------------------------

export function personOfStep(line: LineDraft, step: Step): PersonDraft | null {
  switch (step.kind) {
    case "person":
    case "fact":
    case "confirm":
      return personById(line, step.personId);
    case "add-ancestor":
      return personById(line, step.childId);
    case "done":
      return null;
  }
}

/**
 * The question, addressed to the person filling the form.
 *
 * Uses `addressOf` rather than `labelOf` throughout: "did you stop being a
 * British subject" is the question, and "did the applicant stop being a British
 * subject" is a form. The report is the other way round, and `labelOf` is what
 * the engine is handed.
 */
export function questionText(line: LineDraft, step: Step): string {
  const person = personOfStep(line, step);
  const who = person === null ? "this person" : addressOf(line, person);

  switch (step.kind) {
    case "person":
      return person !== null && person.id === applicantOf(line)?.id
        ? "Start with yourself"
        : `Tell us about ${midSentence(who)}`;
    case "fact":
      return questionFor(step.factId, who);
    case "confirm":
      return `Things we assumed about ${midSentence(who)}`;
    case "add-ancestor":
      return `Who was ${possessive(midSentence(who))} parent?`;
    case "done":
      return "There is enough here for an answer";
  }
}

/** "you" -> "your", "Grandmother Alice" -> "Grandmother Alice's". */
export function possessive(label: string): string {
  if (label === "you") return "your";
  return label.endsWith("s") ? `${label}'` : `${label}'s`;
}

/**
 * The assumptions a confirm screen is about, in the order the engine reported
 * them. Empty once an earlier answer has made them all moot.
 */
export function confirmSubjects(line: LineDraft, step: Step): Assumption[] {
  if (step.kind !== "confirm") return [];
  const person = personById(line, step.personId);
  if (person === null) return [];
  const result = classifyLine(line);
  if (result === null) return [];
  return pendingConfirmations(result, person);
}

// ---------------------------------------------------------------------------
// The trail
// ---------------------------------------------------------------------------

/**
 * One place already visited, and the ordinal that goes back to it.
 *
 * The ordinal is read at the moment the trail is built and used immediately, so
 * it never has the chance to rot the way a stored one would. A `StepRef` is what
 * gets written down; this is what gets clicked.
 */
export type Crumb = {
  index: number;
  step: Step;
  /** A few words. The person is named by the group, so this does not repeat it. */
  label: string;
  current: boolean;
};

export type CrumbGroup = {
  personId: string;
  /** "You", "Your grandmother", or whatever name was typed in. */
  label: string;
  crumbs: Crumb[];
};

/**
 * Everywhere the user has been, grouped by generation.
 *
 * **Grouped rather than laid out in queue order**, because the queue order is
 * not the order anyone remembers answering in: identity screens for the whole
 * line come before any fact about anyone, and the confirm pass comes after
 * everything. "Change my grandmother's birth date" is the actual errand, so the
 * generation is what the trail is organised around.
 *
 * **Applicant first**, which is the reverse of how `people` is stored. The line
 * is stored anchor-first because that is what the engine wants; it is entered
 * from the applicant backwards, one generation at a time, and that is the order
 * it reads in.
 *
 * Only resolved steps appear, plus the one being shown and the frontier. The
 * trail is a record of where you have been, not a table of contents for
 * questions that have not been put yet, and half of those would evaporate
 * before they were reached anyway.
 *
 * Empty where there is nowhere to go: a trail whose only entry is the screen
 * you are looking at is furniture. The rule lives here rather than in the
 * component so that the screens that mention the trail in their own text can
 * ask whether there is one.
 */
export function crumbTrail(line: LineDraft, shown: Step): CrumbGroup[] {
  const plan = stepPlan(line);
  const frontier = plan.findIndex((planned) => !planned.resolved);
  const shownIndex = plan.findIndex((planned) => sameStep(planned.step, shown));

  const crumbs: Crumb[] = [];
  plan.forEach((planned, index) => {
    if (!planned.resolved && index !== frontier && index !== shownIndex) return;
    crumbs.push({
      index,
      step: planned.step,
      label: crumbLabel(planned.step),
      current: index === shownIndex,
    });
  });

  if (crumbs.length < 2) return [];

  return [...line.people]
    .reverse()
    .map((person) => ({
      personId: person.id,
      label: sentenceStart(addressOf(line, person)),
      crumbs: crumbs.filter((crumb) => personIdOf(crumb.step) === person.id),
    }))
    .filter((group) => group.crumbs.length > 0);
}

function personIdOf(step: Step): string | null {
  switch (step.kind) {
    case "person":
    case "fact":
    case "confirm":
      return step.personId;
    case "add-ancestor":
      return step.childId;
    case "done":
      return null;
  }
}

function crumbLabel(step: Step): string {
  switch (step.kind) {
    case "person":
      return "Dates and places";
    case "fact":
      return FACTS[step.factId].short;
    case "confirm":
      return "What we assumed";
    case "add-ancestor":
      return "Anyone earlier";
    case "done":
      return "The result";
  }
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

/** One line of a confirm screen: correct the assumption, or leave it standing. */
export type Confirmation = { factId: FactId; correction: boolean | null };

export type AnswerValue =
  /** The identity screen, submitted whole: label, dates, place, living. */
  | { kind: "person"; patch: Partial<PersonDraft> }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  /** "I do not know yet." Removes the value and stops the question recurring. */
  | { kind: "unknown" }
  /** The confirm screen, submitted whole: one decision per assumption. */
  | { kind: "confirm"; confirmations: Confirmation[] }
  /** `kind` labels the new generation; the engine does not model sex. */
  | { kind: "add-ancestor"; parent: ParentKind }
  /** "I do not know who their parent was." Ends the line without an anchor. */
  | { kind: "no-earlier-ancestor" };

/**
 * Records an answer and returns the new line.
 *
 * Always clears `pendingEdit`: the edit requested from the results page has now
 * been made, and leaving it set would pin the interview to that one screen.
 */
export function applyAnswer(
  line: LineDraft,
  step: Step,
  value: AnswerValue,
): LineDraft {
  return setPendingEdit(apply(line, step, value), null);
}

function apply(line: LineDraft, step: Step, value: AnswerValue): LineDraft {
  switch (step.kind) {
    case "person": {
      if (value.kind !== "person") return line;
      const updated = updatePerson(line, step.personId, value.patch);
      // Submitting the screen is what a GEDCOM prefill was waiting for: the
      // file suggests, the person confirms.
      return confirmGedcom(updated, step.personId);
    }

    case "fact": {
      switch (value.kind) {
        case "boolean":
        case "number":
          return setFact(line, step.personId, step.factId, value.value);
        case "unknown":
          return clearFact(line, step.personId, step.factId);
        default:
          return line;
      }
    }

    case "confirm": {
      if (value.kind !== "confirm") return line;
      return value.confirmations.reduce(
        (current, { factId, correction }) =>
          correction === null
            ? // Deliberately does not set the fact. The engine goes on saying
              // it was assumed, the results page badges it "you confirmed
              // this", and this is what makes the confirm pass terminate.
              acceptDefault(current, step.personId, factId)
            : setFact(current, step.personId, factId, correction),
        line,
      );
    }

    case "add-ancestor":
      switch (value.kind) {
        case "add-ancestor":
          return addAncestor(line, value.parent);
        case "no-earlier-ancestor":
          return setNoEarlierAncestor(line, true);
        default:
          return line;
      }

    case "done":
      return line;
  }
}

// ---------------------------------------------------------------------------
// The status strip
// ---------------------------------------------------------------------------

export type Progress = {
  generations: number;
  answered: number;
  done: boolean;
};

export function progressOf(line: LineDraft): Progress {
  return {
    generations: line.people.filter(isCompletePerson).length,
    answered: line.people.reduce(
      (total, person) => total + person.answered.length,
      0,
    ),
    done: isDone(line),
  };
}

/**
 * Structural progress only.
 *
 * **Never the verdict.** Saying "qualifies" halfway through and retracting it
 * two screens later is the worst thing this interface could do, and the word
 * "fails" has no business appearing before the last question is answered. So
 * this counts what has been entered and says nothing about what it means.
 */
export function progressSummary(line: LineDraft): string {
  const progress = progressOf(line);
  if (progress.done) return "There is enough here for an answer.";
  if (progress.generations === 0) return "Nothing entered yet."; 
  const parts = [plural(progress.generations, "generation", "generations") + " entered"];
  if (progress.answered > 0) {
    parts.push(plural(progress.answered, "question", "questions") + " answered");
  }
  return `${parts.join(", ")}.`;
}

/** The honest framing that goes with the counts, once rather than per screen. */
export const PROGRESS_NOTE =
  "There is no fixed number of questions left. Only the ones that could still change your answer get asked, so the list grows and shrinks as you go.";
