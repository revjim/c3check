import { describe, expect, it } from "vitest";
import type { FactId, Person } from "@/lib/c3";
import {
  femaleAnchorChain,
  gcmsChain,
  modernAnchorChain,
  newfoundlandAfterUnionChain,
  newfoundlandBeforeUnionChain,
  overlapChain,
  postCifChain,
  unaskedAnchorChain,
  withFacts,
} from "@/lib/c3/fixtures";
import { classifyLine, newLine, setFact } from "@/lib/draft";
import type { LineDraft, PersonDraft } from "@/lib/draft";
import {
  DONE,
  advanceFrom,
  applyAnswer,
  confirmSubjects,
  crumbTrail,
  currentIndex,
  nextStep,
  progressSummary,
  questionText,
  stepAt,
  stepKey,
  stepPlan,
  stepQueue,
} from "@/lib/interview";
import type { AnswerValue, Step } from "@/lib/interview";

// ---------------------------------------------------------------------------
// Turning an engine fixture into a saved line
// ---------------------------------------------------------------------------

/**
 * Every fixture chain, as though someone had entered it. A fact stated in a
 * fixture is one the user answered, so it goes in `answered` too.
 */
function lineFromChain(chain: Person[], id = "l1"): LineDraft {
  return {
    ...newLine(id, "Test line"),
    applicantId: chain[chain.length - 1].id,
    people: chain.map((person) => ({
      id: person.id,
      label: person.label ?? null,
      birthDate: person.birthDate,
      birthDateApproximate: false,
      birthRegion: person.birthRegion,
      living: person.deathDate === undefined,
      deathDate: person.deathDate ?? null,
      facts: { ...person.facts },
      answered: Object.keys(person.facts ?? {}) as FactId[],
      acceptedDefaults: [],
      source: "entered" as const,
    })),
    nextPersonSeq: chain.length + 1,
  };
}

const FIXTURES: { name: string; chain: Person[] }[] = [
  { name: "gcmsChain", chain: gcmsChain },
  { name: "femaleAnchorChain", chain: femaleAnchorChain },
  { name: "modernAnchorChain", chain: modernAnchorChain },
  { name: "overlapChain", chain: overlapChain },
  { name: "newfoundlandBeforeUnionChain", chain: newfoundlandBeforeUnionChain },
  { name: "newfoundlandAfterUnionChain", chain: newfoundlandAfterUnionChain },
  { name: "postCifChain", chain: postCifChain() },
  { name: "unaskedAnchorChain", chain: unaskedAnchorChain },
];

/** Every fact the queue puts in front of the user, asked or confirmed. */
function factIdsIn(line: LineDraft): FactId[] {
  return stepQueue(line).flatMap((step) => {
    if (step.kind === "fact") return [step.factId];
    if (step.kind === "confirm") {
      return confirmSubjects(line, step).map((a) => a.factId as FactId);
    }
    return [];
  });
}

function unresolvedFactIds(line: LineDraft): FactId[] {
  return stepPlan(line).flatMap((planned) =>
    !planned.resolved && planned.step.kind === "fact"
      ? [planned.step.factId]
      : [],
  );
}

// ---------------------------------------------------------------------------

describe("queue order", () => {
  it("asks every identity before any fact", () => {
    // Materiality is computed over the whole chain, so an ancestor added above
    // can retire the facts you were about to ask below. It is also the only
    // order the engine can be run in at all: it cannot classify a half-typed
    // birth date.
    const line = lineFromChain(unaskedAnchorChain);
    const gappy: LineDraft = {
      ...line,
      people: line.people.map((person, i) =>
        i === 0 ? { ...person, birthRegion: null } : person,
      ),
    };
    expect(stepQueue(gappy).every((step) => step.kind === "person")).toBe(true);
    expect(nextStep(gappy)).toEqual({ kind: "person", personId: "g0" });
  });

  it("starts a brand new line with the applicant's own screen", () => {
    const line = newLine("l1", "Your line");
    expect(nextStep(line)).toEqual({ kind: "person", personId: "p1" });
    expect(questionText(line, nextStep(line))).toBe("Start with yourself");
  });

  it("asks only facts the engine actually reports as missing", () => {
    for (const { name, chain } of FIXTURES) {
      const line = lineFromChain(chain);
      const result = classifyLine(line, { assessAssumptions: false });
      const missing = new Set(result?.missing.map((m) => `${m.personId}:${m.factId}`));
      for (const planned of stepPlan(line)) {
        if (planned.resolved) continue;
        if (planned.step.kind !== "fact") continue;
        expect(
          missing.has(`${planned.step.personId}:${planned.step.factId}`),
          `${name} asked ${planned.step.factId} of ${planned.step.personId}`,
        ).toBe(true);
      }
    }
  });

  it("asks nothing at all once the chain has halted", () => {
    // There is no further question worth putting; the results page carries the
    // reason and the fork.
    const line = lineFromChain(withFacts(gcmsChain, "g2", { adopted: true }));
    expect(classifyLine(line)?.applicant.outcome).toBe("stopped");
    expect(
      stepPlan(line).every((planned) => planned.step.kind === "person"),
    ).toBe(true);
    expect(nextStep(line)).toEqual({ kind: "done" });
  });
});

describe("materiality", () => {
  it("stops asking about (m) and (n) once the anchor settles under (k)", () => {
    // Paragraph (m) is gated behind livedInCanadaOrNewfoundland, which defaults
    // to no. Three further questions about residence in 1947 never get asked of
    // a family that emigrated and stayed away.
    const line = lineFromChain(unaskedAnchorChain);
    expect(unresolvedFactIds(line)).toEqual(["ceasedBritishSubject"]);

    const answered = setFact(line, "g0", "ceasedBritishSubject", true);
    expect(factIdsIn(answered)).not.toContain("britishSubjectOnPivot");
    expect(factIdsIn(answered)).not.toContain("ordinarilyResidentOnPivot");
    expect(classifyLine(answered)?.statuses[0].paragraph).toBe("k");
  });

  it("opens the (m) branch as soon as the family did live in Canada", () => {
    // The dynamic half of the same rule: facts that did not exist in the queue
    // a moment earlier. Answering one question unlocks two more, which is why
    // there is no precomputed question list and no honest progress bar.
    const abroad: Person[] = [
      { id: "g0", label: "G0", birthDate: "1910-10-10", birthRegion: "outside" },
    ];
    const closed = lineFromChain(abroad);
    expect(unresolvedFactIds(closed)).not.toContain("britishSubjectOnPivot");

    const opened = setFact(closed, "g0", "livedInCanadaOrNewfoundland", true);
    expect(unresolvedFactIds(opened)).toContain("britishSubjectOnPivot");
  });

  it("drops an unresolved paragraph that could not have won anyway", () => {
    // An open (m) behind a settled (o) is not a gap, it is a footnote. 3(6.3)
    // would supersede it either way, so its facts are never asked.
    const line = lineFromChain(
      withFacts(overlapChain, "g1", { britishSubjectOnPivot: undefined }),
    );
    const reopened: LineDraft = {
      ...line,
      people: line.people.map((person) =>
        person.id === "g1"
          ? {
              ...person,
              facts: { livedInCanadaOrNewfoundland: true },
              answered: ["livedInCanadaOrNewfoundland"] as FactId[],
            }
          : person,
      ),
    };
    expect(classifyLine(reopened)?.statuses[1].paragraph).toBe("o");
    expect(unresolvedFactIds(reopened)).not.toContain("britishSubjectOnPivot");
  });

  it("asks for presence days only where subsection 3(3) can still bite", () => {
    // C-3 moved the first-generation limit rather than abolishing it: it
    // reaches only births abroad on or after 15 December 2025.
    expect(unresolvedFactIds(lineFromChain(postCifChain()))).toContain(
      "presenceDaysInCanada",
    );
    expect(factIdsIn(lineFromChain(modernAnchorChain))).not.toContain(
      "presenceDaysInCanada",
    );
    expect(factIdsIn(lineFromChain(gcmsChain))).not.toContain(
      "presenceDaysInCanada",
    );
  });

  it("never asks about a citizenship certificate through the queue", () => {
    // certificateIssued has a default, so it can never appear in result.missing
    // or in the assumptions the confirm pass draws from. Its only consumer is a
    // direct lookup in advisory.ts, so it is asked as a special case on the
    // results page, next to the processing-pause advisory that needs it.
    for (const { name, chain } of FIXTURES) {
      expect(factIdsIn(lineFromChain(chain)), name).not.toContain(
        "certificateIssued",
      );
    }
  });
});

describe("adding a generation", () => {
  it("offers one when the verdict is undetermined rather than incomplete", () => {
    // The bug this guards. `incomplete` requires every person to have failed;
    // one undetermined person makes the verdict `undetermined`, and an
    // interview keyed to `incomplete` would stop offering ancestors exactly
    // when they are most needed.
    const chain: Person[] = [
      { id: "g0", label: "G0", birthDate: "1910-01-01", birthRegion: "outside" },
      { id: "g1", label: "G1", birthDate: "1940-01-01", birthRegion: "outside" },
    ];
    const line = lineFromChain(chain);
    expect(stepQueue(line)).toContainEqual({
      kind: "add-ancestor",
      childId: "g0",
    });
  });

  it("stops offering once the topmost person was born in Canada", () => {
    expect(stepQueue(lineFromChain(gcmsChain))).not.toContainEqual({
      kind: "add-ancestor",
      childId: "g0",
    });
  });

  it("keeps the step visible, and resolved, after 'I do not know'", () => {
    const line = lineFromChain([
      { id: "g0", label: "G0", birthDate: "1910-01-01", birthRegion: "outside" },
    ]);
    const step: Step = { kind: "add-ancestor", childId: "g0" };
    const answered = applyAnswer(line, step, { kind: "no-earlier-ancestor" });
    expect(stepQueue(answered)).toContainEqual(step);
    expect(
      stepPlan(answered).find((p) => stepKey(p.step) === stepKey(step))?.resolved,
    ).toBe(true);
  });

  it("adds an empty generation above, and asks about it first", () => {
    const line = lineFromChain([
      { id: "g0", label: "G0", birthDate: "1910-01-01", birthRegion: "outside" },
    ]);
    const added = applyAnswer(
      line,
      { kind: "add-ancestor", childId: "g0" },
      { kind: "add-ancestor", parent: "mother" },
    );
    expect(added.people).toHaveLength(2);
    expect(nextStep(added)).toEqual({ kind: "person", personId: "p2" });
  });

  it("addresses the question to the child, by the name in use", () => {
    const line = lineFromChain([
      { id: "g0", birthDate: "1910-01-01", birthRegion: "outside" },
    ]);
    expect(questionText(line, { kind: "add-ancestor", childId: "g0" })).toBe(
      "Who was your parent?",
    );
  });
});

describe("adding a descendant", () => {
  it("asks once even for a line that has reached an anchor", () => {
    // Unlike the ancestor step, which disappears once there is nothing further
    // back to ask about. A childless line and a line whose children have not
    // been entered look identical, so the question has to be put and answered.
    const line = lineFromChain(gcmsChain);
    expect(stepQueue(line)).toContainEqual({
      kind: "add-descendant",
      parentId: "g4",
    });
    expect(nextStep(line)).toEqual({ kind: "add-descendant", parentId: "g4" });
  });

  it("comes after the ancestor step, so it never interrupts the line", () => {
    const line = lineFromChain([
      { id: "g0", label: "G0", birthDate: "1910-01-01", birthRegion: "outside" },
    ]);
    const kinds = stepPlan(line).map((planned) => planned.step.kind);
    expect(kinds.indexOf("add-descendant")).toBeGreaterThan(
      kinds.indexOf("add-ancestor"),
    );
  });

  it("stays in the queue, resolved, after 'no one after them'", () => {
    const line = lineFromChain(gcmsChain);
    const step: Step = { kind: "add-descendant", parentId: "g4" };
    const answered = applyAnswer(line, step, { kind: "no-later-descendant" });
    expect(stepQueue(answered)).toContainEqual(step);
    expect(
      stepPlan(answered).find((p) => stepKey(p.step) === stepKey(step))?.resolved,
    ).toBe(true);
  });

  it("adds a generation below, asks about it, and re-opens the question", () => {
    const line = lineFromChain(gcmsChain);
    const added = applyAnswer(
      line,
      { kind: "add-descendant", parentId: "g4" },
      { kind: "add-descendant" },
    );
    expect(added.people).toHaveLength(6);
    expect(added.applicantId).toBe("g4");
    // Identity for everyone precedes anything else, so the queue is nothing but
    // person screens until the new row is described.
    expect(nextStep(added)).toEqual({ kind: "person", personId: "p6" });

    const described = applyAnswer(
      added,
      { kind: "person", personId: "p6" },
      fill(added, "p6"),
    );
    // And then the question moves down to the new youngest person.
    expect(stepQueue(described)).toContainEqual({
      kind: "add-descendant",
      parentId: "p6",
    });
  });

  it("addresses the question to the youngest person, by the name in use", () => {
    // The fixture labels its people, so the applicant is addressed by the name
    // in use rather than as "you", the same way every other screen does it.
    expect(
      questionText(lineFromChain(gcmsChain), {
        kind: "add-descendant",
        parentId: "g4",
      }),
    ).toBe("Does G4 have children?");

    const unnamed = lineFromChain([
      { id: "g0", birthDate: "1960-05-04", birthRegion: "canada" },
    ]);
    expect(questionText(unnamed, { kind: "add-descendant", parentId: "g0" })).toBe(
      "Do you have children?",
    );
    const withChild = applyAnswer(
      unnamed,
      { kind: "add-descendant", parentId: "g0" },
      { kind: "add-descendant" },
    );
    expect(
      questionText(withChild, { kind: "add-descendant", parentId: "p2" }),
    ).toBe("Does your child have children?");
  });

  it("keeps the trail pointing at the right question with a child in the line", () => {
    // The contract every ordinal has: read at render, used on the click, and in
    // between it must not have come to mean something else. A child changes the
    // length of the queue, which is exactly when an ordinal would rot.
    const withChild = applyAnswer(
      lineFromChain(gcmsChain),
      { kind: "add-descendant", parentId: "g4" },
      { kind: "add-descendant" },
    );
    const line = applyAnswer(
      withChild,
      { kind: "person", personId: "p6" },
      fill(withChild, "p6"),
    );
    for (const group of crumbTrail(line, nextStep(line))) {
      for (const crumb of group.crumbs) {
        expect(stepKey(stepAt(line, crumb.index))).toBe(stepKey(crumb.step));
      }
    }
    // The child gets a group of their own, and the trail stays youngest first.
    const labels = crumbTrail(line, nextStep(line)).map((g) => g.label);
    expect(labels).toEqual(["Your child", "G4", "G3", "G2", "G1", "G0"]);
  });
});

describe("answering", () => {
  it("records 'I do not know yet' without asking again", () => {
    const line = lineFromChain(unaskedAnchorChain);
    const step = nextStep(line);
    const answered = applyAnswer(line, step, { kind: "unknown" });
    expect(nextStep(answered)).not.toEqual(step);
    // Still genuinely unknown: the person stays undetermined and the results
    // page names the documents that would settle it.
    expect(classifyLine(answered)?.applicant.outcome).toBe("undetermined");
    expect(classifyLine(answered)?.missing.map((m) => m.factId)).toContain(
      "ceasedBritishSubject",
    );
  });

  it("clears a pending edit once the edit has been made", () => {
    const line: LineDraft = {
      ...lineFromChain(unaskedAnchorChain),
      pendingEdit: { kind: "fact", personId: "g0", factId: "ceasedBritishSubject" },
    };
    expect(nextStep(line)).toEqual({
      kind: "fact",
      personId: "g0",
      factId: "ceasedBritishSubject",
    });
    const answered = applyAnswer(line, nextStep(line), {
      kind: "boolean",
      value: true,
    });
    expect(answered.pendingEdit).toBeNull();
  });

  it("takes a pending edit ahead of the frontier", () => {
    const line: LineDraft = {
      ...lineFromChain(gcmsChain),
      pendingEdit: { kind: "person", personId: "g3" },
    };
    expect(nextStep(line)).toEqual({ kind: "person", personId: "g3" });
  });
});

describe("ordinals", () => {
  it("clamps a step number that is out of range to done", () => {
    const line = lineFromChain(gcmsChain);
    expect(stepAt(line, 9999)).toEqual({ kind: "done" });
    expect(stepAt(line, -1)).toEqual({ kind: "done" });
    expect(stepAt(line, Number.NaN)).toEqual({ kind: "done" });
  });

  it("continues from where the user is after an edit, not from the top", () => {
    const line = lineFromChain(gcmsChain);
    const frontier = currentIndex(line);
    // Editing something already answered leaves the frontier where it was.
    expect(advanceFrom(line, 0)).toBe(frontier);
  });
});

describe("the trail", () => {
  it("runs applicant first, the way the line was entered", () => {
    // `people` is stored anchor-first because that is the order the engine
    // wants. Nobody enters a line that way round.
    const line = lineFromChain(gcmsChain);
    const groups = crumbTrail(line, nextStep(line));
    expect(groups.map((group) => group.personId)).toEqual(
      [...line.people].reverse().map((person) => person.id),
    );
  });

  it("calls the applicant's own row 'You'", () => {
    const line = lineFromChain([
      { id: "g0", birthDate: "1910-01-01", birthRegion: "outside" },
      { id: "g1", birthDate: "1950-01-01", birthRegion: "outside" },
    ]);
    expect(crumbTrail(line, nextStep(line)).map((group) => group.label)).toEqual(
      ["You", "Your parent"],
    );
  });

  it("has nothing to show on the first screen of a new line", () => {
    // A trail whose only entry is the screen you are looking at is furniture.
    const line = newLine("l1", "Your line");
    expect(crumbTrail(line, nextStep(line))).toEqual([]);
  });

  it("points every crumb at the step it names", () => {
    // The whole contract of an ordinal: it is read at render and used on the
    // click, and in between it must not have come to mean something else.
    for (const { name, chain } of FIXTURES) {
      const line = lineFromChain(chain);
      for (const group of crumbTrail(line, nextStep(line))) {
        for (const crumb of group.crumbs) {
          expect(stepKey(stepAt(line, crumb.index)), name).toBe(
            stepKey(crumb.step),
          );
        }
      }
    }
  });

  it("shows where you are, and nothing that has not been asked yet", () => {
    const line = lineFromChain(unaskedAnchorChain);
    const crumbs = crumbTrail(line, nextStep(line)).flatMap((g) => g.crumbs);
    const plan = stepPlan(line);
    for (const crumb of crumbs) {
      expect(plan[crumb.index].resolved || crumb.index === currentIndex(line)).toBe(
        true,
      );
    }
    expect(crumbs.filter((crumb) => crumb.current)).toHaveLength(1);
    expect(crumbs.find((crumb) => crumb.current)?.step).toEqual(nextStep(line));
  });

  it("still offers a way back once the interview is done", () => {
    // The trail is the only navigation left on the last screen: the Back
    // button is gone and there is no next question to answer.
    const { line } = runInterview(lineFromChain(modernAnchorChain), evasive);
    expect(nextStep(line)).toEqual({ kind: "done" });
    const crumbs = crumbTrail(line, DONE).flatMap((group) => group.crumbs);
    expect(crumbs.length).toBeGreaterThan(1);
    expect(crumbs.some((crumb) => crumb.current)).toBe(false);
    for (const crumb of crumbs) {
      expect(stepKey(stepAt(line, crumb.index))).toBe(stepKey(crumb.step));
    }
    // Including the assumptions screen, which is where somebody who wants to
    // change their mind is most likely to be headed.
    expect(crumbs.map((crumb) => crumb.step.kind)).toContain("confirm");
  });

  it("names a fact in a few words rather than restating the question", () => {
    const line = setFact(
      lineFromChain(unaskedAnchorChain),
      "g0",
      "ceasedBritishSubject",
      true,
    );
    const labels = crumbTrail(line, nextStep(line)).flatMap((group) =>
      group.crumbs.map((crumb) => crumb.label),
    );
    expect(labels).toContain("Lost British subject status");
    for (const label of labels) {
      expect(label).not.toContain("?");
      expect(label.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("going back to the confirm pass", () => {
  /**
   * The bug: the screen used to hide anything already in `acceptedDefaults`,
   * so having once said "none of these happened", a user who came back to
   * change their mind was told there was nothing left to confirm. Accepting a
   * default stops the interview *putting* the screen; it must not empty it.
   */
  function confirmSteps(line: LineDraft): Step[] {
    return stepQueue(line).filter((step) => step.kind === "confirm");
  }

  it("still has every assumption to show after they were left standing", () => {
    const { line } = runInterview(lineFromChain(modernAnchorChain), evasive);
    const steps = confirmSteps(line);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(confirmSubjects(line, step).length).toBeGreaterThan(0);
    }
  });

  it("takes a correction on the second visit", () => {
    const { line } = runInterview(lineFromChain(modernAnchorChain), evasive);
    const step = confirmSteps(line)[0];
    const factId = confirmSubjects(line, step)[0].factId as FactId;
    const person = line.people.find(
      (candidate) => candidate.id === (step as { personId: string }).personId,
    );
    expect(person?.acceptedDefaults).toContain(factId);

    const corrected = applyAnswer(line, step, {
      kind: "confirm",
      confirmations: [{ factId, correction: true }],
    });
    const after = corrected.people.find(
      (candidate) => candidate.id === person?.id,
    );
    expect(after?.facts[factId]).toBe(true);
    // The correction is an answer now, not an assumption left standing.
    expect(after?.acceptedDefaults).not.toContain(factId);
  });
});

describe("the status strip", () => {
  it("counts what has been entered and says nothing about what it means", () => {
    // Saying "qualifies" halfway through and retracting it two screens later
    // is the worst thing this interface could do.
    const summary = progressSummary(lineFromChain(gcmsChain));
    for (const word of ["qualifies", "fails", "citizen", "paragraph"]) {
      expect(summary.toLowerCase()).not.toContain(word);
    }
    expect(summary).toContain("5 generations entered");
  });

  it("says so plainly once there is enough for an answer", () => {
    const { line } = runInterview(lineFromChain(modernAnchorChain), evasive);
    expect(progressSummary(line)).toBe("There is enough here for an answer.");
  });
});

// ---------------------------------------------------------------------------
// Termination
// ---------------------------------------------------------------------------

/** Facts that halt the chain, answered "no" so a run proves something. */
const HALTING: FactId[] = ["adopted", "lostAndRestored", "citizenshipByGrant"];

function fill(line: LineDraft, personId: string): AnswerValue {
  // Thirty years before the person below, or thirty after the person above for
  // somebody appended to the end of the line, so a chain that grows at both ends
  // still has its birth dates in order.
  const index = line.people.findIndex((p) => p.id === personId);
  const below = yearOf(line.people[index + 1]);
  const above = yearOf(line.people[index - 1]);
  const year = below !== null ? below - 30 : above !== null ? above + 30 : 1900;
  return {
    kind: "person",
    patch: {
      birthDate: `${year}-06-01`,
      birthRegion: "outside",
      living: false,
      deathDate: `${year + 70}-06-01`,
    } satisfies Partial<PersonDraft>,
  };
}

function yearOf(person: PersonDraft | undefined): number | null {
  if (person === undefined) return null;
  const year = Number(person.birthDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

function answerFact(factId: FactId): AnswerValue {
  if (HALTING.includes(factId)) return { kind: "boolean", value: false };
  if (factId === "presenceDaysInCanada") return { kind: "number", value: 0 };
  return { kind: "boolean", value: true };
}

/**
 * The worst answerer the interview can be given: it corrects every assumption
 * it is offered, and says no only where a yes would halt the chain and prove
 * nothing. Correcting an assumption sets the fact, which can open new missing
 * facts and send the queue back to phase 2, and that is the cycle
 * `acceptedDefaults` exists to close.
 */
function adversarial(line: LineDraft, step: Step): AnswerValue {
  switch (step.kind) {
    case "person":
      return fill(line, step.personId);
    case "fact":
      return answerFact(step.factId);
    case "confirm":
      return {
        kind: "confirm",
        confirmations: confirmSubjects(line, step).map((assumption) => {
          const factId = assumption.factId as FactId;
          return {
            factId,
            correction: HALTING.includes(factId) ? false : true,
          };
        }),
      };
    case "add-ancestor":
      return { kind: "no-earlier-ancestor" };
    case "add-descendant":
      return { kind: "no-later-descendant" };
    case "done":
      return { kind: "unknown" };
  }
}

/** The other extreme: every question declined, every assumption left standing. */
function evasive(line: LineDraft, step: Step): AnswerValue {
  switch (step.kind) {
    case "person":
      return fill(line, step.personId);
    case "fact":
      return { kind: "unknown" };
    case "confirm":
      return {
        kind: "confirm",
        confirmations: confirmSubjects(line, step).map((assumption) => ({
          factId: assumption.factId as FactId,
          correction: null,
        })),
      };
    case "add-ancestor":
      return { kind: "no-earlier-ancestor" };
    case "add-descendant":
      return { kind: "no-later-descendant" };
    case "done":
      return { kind: "unknown" };
  }
}

/** Adds two generations before giving up, to exercise the identity screens. */
function persistent(line: LineDraft, step: Step): AnswerValue {
  if (step.kind === "add-ancestor") {
    return line.people.length < 8
      ? { kind: "add-ancestor", parent: "mother" }
      : { kind: "no-earlier-ancestor" };
  }
  return adversarial(line, step);
}

/**
 * Extends the line forward as well as backward, so termination is proved for a
 * chain that grows at both ends. The caps stand in for a user who stops: with
 * neither, "add another" is an answer that always makes more work, and no
 * interview over a growing chain terminates.
 */
function prolific(line: LineDraft, step: Step): AnswerValue {
  if (step.kind === "add-descendant") {
    return line.people.length < 8
      ? { kind: "add-descendant" }
      : { kind: "no-later-descendant" };
  }
  return persistent(line, step);
}

const CAP = 200;

/**
 * Every individual question a step puts, which for a confirm screen is one per
 * outstanding assumption rather than one per screen. A confirm screen can
 * legitimately be shown twice, because correcting one assumption can make
 * another decisive that was not before; what must never repeat is a single
 * (person, fact) pair.
 */
function questionsIn(line: LineDraft, step: Step): string[] {
  if (step.kind !== "confirm") return [stepKey(step)];
  return confirmSubjects(line, step).map(
    (assumption) => `confirm:${assumption.personId}:${assumption.factId}`,
  );
}

function runInterview(
  line: LineDraft,
  answer: (line: LineDraft, step: Step) => AnswerValue,
): { line: LineDraft; asked: string[]; screens: string[] } {
  let current = line;
  const asked: string[] = [];
  const screens: string[] = [];
  for (let i = 0; i < CAP; i++) {
    const step = nextStep(current);
    if (step.kind === "done") return { line: current, asked, screens };
    screens.push(stepKey(step));
    asked.push(...questionsIn(current, step));
    current = applyAnswer(current, step, answer(current, step));
  }
  throw new Error(
    `The interview did not terminate in ${CAP} steps. Last: ${screens.slice(-6).join(", ")}`,
  );
}

describe("termination", () => {
  const answerers = [
    { name: "adversarial", answer: adversarial },
    { name: "evasive", answer: evasive },
    { name: "persistent", answer: persistent },
    { name: "prolific", answer: prolific },
  ];

  for (const { name, chain } of FIXTURES) {
    for (const answerer of answerers) {
      it(`terminates for ${name}, answered ${answerer.name}`, () => {
        // The single most valuable test here. It is what guards the confirm
        // pass against the cycle where answering "yes" opens a fact, which
        // opens an assumption, which is asked again.
        const { line } = runInterview(lineFromChain(chain), answerer.answer);
        expect(nextStep(line)).toEqual({ kind: "done" });
      });
    }
  }

  it("terminates from an empty line", () => {
    const { line } = runInterview(newLine("l1", "Your line"), persistent);
    expect(nextStep(line)).toEqual({ kind: "done" });
  });

  it("never puts the same question twice", () => {
    for (const answerer of answerers) {
      for (const { name, chain } of FIXTURES) {
        const { asked } = runInterview(lineFromChain(chain), answerer.answer);
        const repeated = asked.filter(
          (question, i) => asked.indexOf(question) !== i,
        );
        expect(repeated, `${name}, answered ${answerer.name}`).toEqual([]);
      }
    }
  });

  it("keeps the whole interview shorter than the chain is long, times the catalogue", () => {
    // The bound the termination argument rests on: every answer removes one
    // (person, fact) pair from the pool permanently, and the pool is the
    // eighteen facts in the catalogue times the number of generations.
    for (const { name, chain } of FIXTURES) {
      const { screens } = runInterview(lineFromChain(chain), adversarial);
      expect(screens.length, name).toBeLessThanOrEqual(18 * chain.length);
    }
  });

  it("leaves nothing unresolved when it says it is done", () => {
    for (const { name, chain } of FIXTURES) {
      const { line } = runInterview(lineFromChain(chain), adversarial);
      const unresolved = stepPlan(line).filter((planned) => !planned.resolved);
      expect(unresolved.map((p) => stepKey(p.step)), name).toEqual([]);
    }
  });
});
