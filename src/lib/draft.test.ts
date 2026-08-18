import { describe, expect, it } from "vitest";
import {
  DRAFT_VERSION,
  addAncestor,
  addDescendant,
  addLine,
  addressOf,
  applicantOf,
  chainFrom,
  classifyLine,
  clearFact,
  defaultLabel,
  emptyDraft,
  forkLine,
  isCompletePerson,
  labelOf,
  midSentence,
  migrateDraft,
  migrateLine,
  needsAncestor,
  parseDraft,
  serializeDraft,
  setFact,
  setNoLaterDescendant,
  updatePerson,
} from "@/lib/draft";
import type { Draft, LineDraft, PersonDraft } from "@/lib/draft";
import { newLine } from "@/lib/draft";

// ---------------------------------------------------------------------------
// Fixtures. Synthetic, like everything in src/lib/c3/fixtures.ts.
// ---------------------------------------------------------------------------

function person(id: string, patch: Partial<PersonDraft> = {}): PersonDraft {
  return {
    id,
    label: null,
    birthDate: "1970-08-08",
    birthDateApproximate: false,
    birthRegion: "outside",
    living: true,
    deathDate: null,
    facts: {},
    answered: [],
    acceptedDefaults: [],
    source: "entered",
    ...patch,
  };
}

function lineOf(people: PersonDraft[]): LineDraft {
  return {
    ...newLine("l1", "Your line"),
    people,
    // The youngest person, which is what a line with no descendants in it means.
    applicantId: people[people.length - 1]?.id ?? "p1",
    nextPersonSeq: people.length + 1,
  };
}

/** The published GCMS shape: a (k) anchor born in Canada, then four abroad. */
const gcmsLine = lineOf([
  person("p5", {
    birthDate: "1870-03-02",
    birthRegion: "canada",
    living: false,
    deathDate: "1946-08-14",
    facts: { ceasedBritishSubject: true },
    answered: ["ceasedBritishSubject"],
  }),
  person("p4", {
    birthDate: "1898-06-15",
    living: false,
    deathDate: "1967-05-04",
  }),
  person("p3", { birthDate: "1921-09-30" }),
  person("p2", { birthDate: "1944-02-11" }),
  person("p1", { birthDate: "1970-08-08" }),
]);

// ---------------------------------------------------------------------------

describe("person completeness", () => {
  it("refuses a birth date that is ISO-shaped but not a real day", () => {
    // isoDate would accept this and the engine would compare it as a date.
    expect(isCompletePerson(person("p1", { birthDate: "1931-02-31" }))).toBe(
      false,
    );
    expect(isCompletePerson(person("p1", { birthDate: "1931-02-28" }))).toBe(
      true,
    );
  });

  it("treats a half-typed date as incomplete rather than as a value", () => {
    expect(isCompletePerson(person("p1", { birthDate: "1931-0" }))).toBe(false);
  });

  it("holds out for an unanswered living question", () => {
    expect(isCompletePerson(person("p1", { living: null }))).toBe(false);
  });

  it("does not count an unconfirmed GEDCOM prefill as an answer", () => {
    const prefilled = person("p1", {
      source: "gedcom",
      gedcom: { xref: "@I1@", confirmed: false },
    });
    expect(isCompletePerson(prefilled)).toBe(false);
    expect(
      isCompletePerson({
        ...prefilled,
        gedcom: { xref: "@I1@", confirmed: true },
      }),
    ).toBe(true);
  });
});

describe("chainFrom", () => {
  it("hands the engine a chain anchor first, in the order it is stored", () => {
    const chain = chainFrom(gcmsLine);
    expect(chain?.map((p) => p.id)).toEqual(["p5", "p4", "p3", "p2", "p1"]);
    expect(chain?.[0].birthRegion).toBe("canada");
  });

  it("reproduces the published k -> o -> q -> q -> g cascade", () => {
    // The same shape classify.test.ts asserts against, arrived at through the
    // draft layer rather than through a hand-written Person[].
    const result = classifyLine(gcmsLine);
    expect(result?.statuses.map((s) => s.paragraph)).toEqual([
      "k",
      "o",
      "q",
      "q",
      "g",
    ]);
  });

  it("returns null rather than a partial chain", () => {
    // classifyChain throws on an empty array and isoDate throws on a
    // half-typed date; a results page is a bad place to find that out.
    const incomplete = lineOf([person("p1", { birthDate: "" })]);
    expect(chainFrom(incomplete)).toBeNull();
    expect(classifyLine(incomplete)).toBeNull();
    expect(chainFrom(lineOf([]))).toBeNull();
    expect(classifyLine(lineOf([]))).toBeNull();
  });

  it("never emits an invalid calendar date", () => {
    const bad = lineOf([person("p1", { birthDate: "2001-02-30" })]);
    expect(chainFrom(bad)).toBeNull();
  });

  it("omits a death date rather than sending null through", () => {
    // Person.deathDate is optional, and the engine reads `undefined` as "not
    // known" and assumes aliveness. An explicit null would be a type error.
    const chain = chainFrom(lineOf([person("p1")]));
    expect(chain?.[0]).not.toHaveProperty("deathDate");
  });
});

describe("labels", () => {
  it("derives a label from position when none was given", () => {
    // Third person, not "You": every sentence the engine builds reads
    // "`${label}` is a citizen under paragraph 3(1)(g)", so "You" would put
    // "You is a citizen" on the headline of the finished report. `addressOf`
    // is the second-person form the interview asks questions with.
    expect(labelOf(gcmsLine, gcmsLine.people[4])).toBe("The applicant");
    expect(addressOf(gcmsLine, gcmsLine.people[4])).toBe("you");
    expect(labelOf(gcmsLine, gcmsLine.people[3])).toBe("Your parent");
    expect(labelOf(gcmsLine, gcmsLine.people[0])).toBe(
      "Your great-great-grandparent",
    );
  });

  it("stops spelling out the greats once nobody could count them", () => {
    expect(defaultLabel(5)).toBe("Your 3x-great-grandparent");
  });

  it("has a word for every generation forward as well as back", () => {
    // `generationsBack` goes negative for a descendant, and `defaultLabel` has a
    // `default` arm that catches any number it was not given a case for. Without
    // these, a grandchild renders as "Your -2x-great-grandparent" on a report
    // somebody is about to act on.
    expect(defaultLabel(-1)).toBe("Your child");
    expect(defaultLabel(-2)).toBe("Your grandchild");
    expect(defaultLabel(-3)).toBe("Your great-grandchild");
    expect(defaultLabel(-4)).toBe("Your 2x-great-grandchild");
    for (let back = -8; back <= 8; back++) {
      expect(defaultLabel(back), `back ${back}`).not.toContain("-1x");
      expect(defaultLabel(back), `back ${back}`).not.toMatch(/\s-\d/);
    }
  });

  it("labels a descendant forward and an ancestor back from the same person", () => {
    const withChild = addDescendant(gcmsLine);
    const withGrandchild = addDescendant(withChild);
    expect(labelOf(withGrandchild, withGrandchild.people[5])).toBe("Your child");
    expect(labelOf(withGrandchild, withGrandchild.people[6])).toBe(
      "Your grandchild",
    );
    // The applicant does not move, and neither does anybody above them.
    expect(labelOf(withGrandchild, withGrandchild.people[4])).toBe(
      "The applicant",
    );
    expect(labelOf(withGrandchild, withGrandchild.people[0])).toBe(
      "Your great-great-grandparent",
    );
    expect(addressOf(withGrandchild, withGrandchild.people[4])).toBe("you");
  });

  it("prefers what the user called them", () => {
    const named = lineOf([person("p1", { label: "Grandmother Alice" })]);
    expect(labelOf(named, named.people[0])).toBe("Grandmother Alice");
    expect(addressOf(named, named.people[0])).toBe("Grandmother Alice");
  });

  it("drops the capital on a generated label mid-sentence, but not on a name", () => {
    // "Who was your mother's parent?" is right; "Who was alice's parent?" is
    // not, so this matches the two generated forms rather than lowercasing.
    expect(midSentence("Your mother")).toBe("your mother");
    expect(midSentence("The applicant")).toBe("the applicant");
    expect(midSentence("Alice")).toBe("Alice");
    expect(midSentence("Your Aunt Mabel")).toBe("your Aunt Mabel");
  });

  it("ignores a label that is only whitespace", () => {
    const blank = lineOf([person("p1", { label: "   " })]);
    expect(labelOf(blank, blank.people[0])).toBe("The applicant");
  });
});

describe("adding a generation", () => {
  it("keeps every existing person id stable", () => {
    // Ids appear in every trace, flag and assumption the engine emits, and in
    // the pendingEdit written by "change this answer". Renumbering on unshift
    // would silently repoint all of them.
    const before = lineOf([person("p1"), person("p2")]);
    const after = addAncestor(before);
    expect(after.people.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });

  it("relabels by position without touching any stored label", () => {
    const before = lineOf([person("p1")]);
    const after = addAncestor(before);
    expect(after.people.every((p) => p.label === null)).toBe(true);
    expect(labelOf(after, after.people[0])).toBe("Your parent");
    expect(labelOf(after, after.people[1])).toBe("The applicant");
  });

  it("counts a stated mother back from the applicant, not from the array", () => {
    // The bug an appended descendant introduces: `addAncestor` used to derive
    // the new label from `people.length`, which stops being the applicant's
    // distance from the top the moment there is anybody below them.
    const withChild = addDescendant(lineOf([person("p2"), person("p1")]));
    const added = addAncestor(withChild, "mother");
    expect(added.people[0].label).toBe("Your grandmother");
    expect(labelOf(added, added.people[0])).toBe("Your grandmother");
  });
});

describe("adding a descendant", () => {
  it("appends without disturbing an id or the applicant", () => {
    const before = lineOf([person("p2"), person("p1")]);
    const after = addDescendant(before);
    expect(after.people.map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
    expect(after.applicantId).toBe("p1");
    expect(applicantOf(after)?.id).toBe("p1");
    expect(after.nextPersonSeq).toBe(4);
  });

  it("clears a previous 'no one after them'", () => {
    const closed = setNoLaterDescendant(lineOf([person("p1")]), true);
    expect(addDescendant(closed).noLaterDescendant).toBe(false);
  });

  it("keeps the answer about the applicant, and classifies the child too", () => {
    // The engine needed no teaching for this: each person's parent is simply the
    // entry before them. What it could not do is guess whose answer is reported.
    const withChild = addDescendant(gcmsLine);
    const child = updatePerson(withChild, "p6", {
      birthDate: "2001-04-05",
      birthRegion: "outside",
      living: true,
    });
    const result = classifyLine(child);
    expect(result?.statuses.map((s) => s.paragraph)).toEqual([
      "k",
      "o",
      "q",
      "q",
      "g",
      "b",
    ]);
    expect(result?.applicant.personId).toBe("p1");
    expect(result?.applicantIndex).toBe(4);
    expect(result?.headline.paragraph).toBe("g");
  });
});

describe("facts", () => {
  it("round-trips a fact answered false", () => {
    // The trap this schema exists for: `false` answered is not the same as
    // `undefined` unasked. The engine reads the first as an answer and the
    // second as an assumption, and JSON must not collapse them.
    const line = setFact(lineOf([person("p1")]), "p1", "adopted", false);
    const draft: Draft = { ...emptyDraft(), lines: [line], currentLineId: "l1" };
    const restored = parseDraft(serializeDraft(draft));
    const person1 = restored.lines[0].people[0];
    expect(person1.facts.adopted).toBe(false);
    expect(Object.hasOwn(person1.facts, "adopted")).toBe(true);
    expect(person1.answered).toEqual(["adopted"]);
  });

  it("records 'I do not know yet' as asked, without a value", () => {
    // Otherwise the fact stays in result.missing and the interview asks it
    // again on the very next pass, forever.
    const line = clearFact(lineOf([person("p1")]), "p1", "ceasedBritishSubject");
    expect(line.people[0].facts.ceasedBritishSubject).toBeUndefined();
    expect(line.people[0].answered).toEqual(["ceasedBritishSubject"]);
  });

  it("does not answer the question twice in the answered list", () => {
    let line = setFact(lineOf([person("p1")]), "p1", "adopted", false);
    line = setFact(line, "p1", "adopted", true);
    expect(line.people[0].answered).toEqual(["adopted"]);
    expect(line.people[0].facts.adopted).toBe(true);
  });

  it("clears a death date when someone is marked as living", () => {
    const line = updatePerson(
      lineOf([person("p1", { living: false, deathDate: "2001-01-01" })]),
      "p1",
      { living: true },
    );
    expect(line.people[0].deathDate).toBeNull();
  });
});

describe("needsAncestor", () => {
  it("offers another generation while the topmost person was born abroad", () => {
    const line = lineOf([
      person("p2", { birthDate: "1944-02-11" }),
      person("p1", { birthDate: "1970-08-08" }),
    ]);
    expect(needsAncestor(line)).toBe(true);
  });

  it("keeps offering one when the verdict is undetermined, not incomplete", () => {
    // The reason this is not driven off headline.verdict. lacksAnchor requires
    // every person to have failed; one undetermined person anywhere makes the
    // verdict `undetermined`, and an interview keyed to `incomplete` would stop
    // offering ancestors at exactly the point they are most needed.
    const line = lineOf([
      person("p2", {
        birthDate: "1900-09-09",
        birthRegion: "canada",
        living: false,
        deathDate: "1970-01-01",
      }),
      person("p1", { birthDate: "1930-03-03" }),
    ]);
    const result = classifyLine(line);
    expect(result?.headline.verdict).toBe("undetermined");
    // The anchor is born in Canada, so there is nothing further back to ask for.
    expect(needsAncestor(line)).toBe(false);

    const allAbroad = lineOf([
      person("p2", { birthDate: "1900-09-09" }),
      person("p1", { birthDate: "1930-03-03" }),
    ]);
    expect(classifyLine(allAbroad)?.headline.verdict).toBe("incomplete");
    expect(needsAncestor(allAbroad)).toBe(true);
  });

  it("stops the moment the topmost person was born in Canada", () => {
    expect(needsAncestor(gcmsLine)).toBe(false);
  });

  it("stops for someone born abroad who naturalised in Canada", () => {
    const line = lineOf([
      person("p2", {
        birthDate: "1900-09-09",
        facts: { naturalizedInCanada: true, ceasedBritishSubject: true },
      }),
      person("p1", { birthDate: "1930-03-03" }),
    ]);
    expect(needsAncestor(line)).toBe(false);
  });

  it("stops once the user says there is no earlier ancestor", () => {
    const line = { ...lineOf([person("p1")]), noEarlierAncestor: true };
    expect(needsAncestor(line)).toBe(false);
  });

  it("says no while an identity is still incomplete", () => {
    // Identity gaps are asked before this, so reaching it with one outstanding
    // means the caller has the queue out of order.
    const line = lineOf([person("p1", { birthRegion: null })]);
    expect(needsAncestor(line)).toBe(false);
  });
});

describe("migrateDraft", () => {
  it("returns an empty draft for unrecognised JSON rather than throwing", () => {
    expect(migrateDraft(null)).toEqual(emptyDraft());
    expect(migrateDraft("a string")).toEqual(emptyDraft());
    expect(migrateDraft(42)).toEqual(emptyDraft());
    expect(migrateDraft([])).toEqual(emptyDraft());
    expect(migrateDraft({ version: 99, lines: [] })).toEqual(emptyDraft());
    expect(migrateDraft({ version: 1 })).toEqual(emptyDraft());
  });

  it("survives text that is not JSON at all", () => {
    expect(parseDraft("{not json")).toEqual(emptyDraft());
    expect(parseDraft(null)).toEqual(emptyDraft());
    expect(parseDraft("")).toEqual(emptyDraft());
  });

  it("drops a line with no people, and a person with no id", () => {
    const migrated = migrateDraft({
      version: 1,
      lines: [
        { id: "l1", name: "Empty", people: [] },
        { id: "l2", name: "Partly bad", people: [{}, { id: "p1" }] },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines.map((l) => l.id)).toEqual(["l2"]);
    expect(migrated.lines[0].people.map((p) => p.id)).toEqual(["p1"]);
    // The stored current line is gone, so it falls back to one that exists.
    expect(migrated.currentLineId).toBe("l2");
  });

  it("discards a fact that is not in the catalogue", () => {
    const migrated = migrateDraft({
      version: 1,
      lines: [
        {
          id: "l1",
          name: "L",
          people: [{ id: "p1", facts: { adopted: true, wealthy: true } }],
        },
      ],
      currentLineId: "l1",
    });
    const facts = migrated.lines[0].people[0].facts;
    expect(facts.adopted).toBe(true);
    expect(Object.keys(facts)).toEqual(["adopted"]);
  });

  it("never lets nextPersonSeq collide with an id already in use", () => {
    // A stored seq behind the ids would mint a duplicate on the next
    // addAncestor, and two generations would share an id.
    const migrated = migrateDraft({
      version: 1,
      lines: [
        {
          id: "l1",
          name: "L",
          nextPersonSeq: 1,
          people: [{ id: "p7" }, { id: "p3" }],
        },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines[0].nextPersonSeq).toBe(8);
  });

  it("drops a pendingEdit that points at somebody who is gone", () => {
    const migrated = migrateDraft({
      version: 1,
      lines: [
        {
          id: "l1",
          name: "L",
          people: [{ id: "p1" }],
          pendingEdit: { kind: "person", personId: "p9" },
        },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines[0].pendingEdit).toBeNull();
  });

  it("keeps a pendingEdit that still resolves", () => {
    const migrated = migrateDraft({
      version: 1,
      lines: [
        {
          id: "l1",
          name: "L",
          people: [{ id: "p1" }],
          pendingEdit: { kind: "fact", personId: "p1", factId: "adopted" },
        },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines[0].pendingEdit).toEqual({
      kind: "fact",
      personId: "p1",
      factId: "adopted",
    });
  });

  it("upgrades a version 1 draft rather than discarding it", () => {
    // The trap: `migrateDraft` compared the stored version to DRAFT_VERSION for
    // equality, so bumping the constant on its own would have thrown away every
    // draft in progress, silently, on the deploy. A version 1 document has no
    // applicantId, because the applicant was the last entry by definition.
    const migrated = migrateDraft({
      version: 1,
      lines: [
        {
          id: "l1",
          name: "Your line",
          nextPersonSeq: 3,
          people: [
            { id: "p2", birthDate: "1944-02-11", birthRegion: "canada" },
            { id: "p1", birthDate: "1970-08-08", birthRegion: "outside" },
          ],
        },
      ],
      currentLineId: "l1",
    });
    expect(migrated.version).toBe(DRAFT_VERSION);
    expect(migrated.lines).toHaveLength(1);
    expect(migrated.lines[0].people.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(migrated.lines[0].applicantId).toBe("p1");
    expect(migrated.lines[0].noLaterDescendant).toBe(false);
    expect(applicantOf(migrated.lines[0])?.id).toBe("p1");
  });

  it("refuses an applicantId naming somebody who is not in the line", () => {
    // It would otherwise index off the end of the chain, and every read of the
    // applicant on the report would be undefined.
    const migrated = migrateDraft({
      version: DRAFT_VERSION,
      lines: [
        { id: "l1", name: "L", applicantId: "p9", people: [{ id: "p1" }] },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines[0].applicantId).toBe("p1");
  });

  it("keeps an applicantId that is not the last person", () => {
    const migrated = migrateDraft({
      version: DRAFT_VERSION,
      lines: [
        {
          id: "l1",
          name: "L",
          applicantId: "p1",
          people: [{ id: "p2" }, { id: "p1" }, { id: "p3" }],
        },
      ],
      currentLineId: "l1",
    });
    expect(migrated.lines[0].applicantId).toBe("p1");
  });

  it("validates one line on its own, for a document that carries one", () => {
    // What a markdown import reuses, rather than writing a second validator.
    expect(migrateLine({ id: "l1", people: [{ id: "p1" }] })?.applicantId).toBe(
      "p1",
    );
    expect(migrateLine({ id: "l1", people: [] })).toBeNull();
    expect(migrateLine({ people: [{ id: "p1" }] })).toBeNull();
    expect(migrateLine("nonsense")).toBeNull();
  });

  it("round-trips a full draft unchanged", () => {
    const draft: Draft = {
      ...emptyDraft(),
      lines: [gcmsLine],
      currentLineId: "l1",
    };
    expect(parseDraft(serializeDraft(draft))).toEqual(draft);
  });
});

describe("forkLine", () => {
  it("keeps the fork point and everyone below, and drops the ancestors above", () => {
    const draft: Draft = {
      ...emptyDraft(),
      lines: [gcmsLine],
      currentLineId: "l1",
    };
    const forked = forkLine(draft, "l1", "p3", "Other parent's line");
    expect(forked?.draft.lines[1].people.map((p) => p.id)).toEqual([
      "p3",
      "p2",
      "p1",
    ]);
    expect(forked?.draft.currentLineId).toBe("l2");
    expect(forked?.draft.lines[1].forkedFrom).toEqual({
      lineId: "l1",
      atPersonId: "p3",
    });
  });

  it("leaves the original alone, down to its nested objects", () => {
    const draft: Draft = {
      ...emptyDraft(),
      lines: [gcmsLine],
      currentLineId: "l1",
    };
    const forked = forkLine(draft, "l1", "p5", "Copy");
    const copiedAnchor = forked?.draft.lines[1].people[0];
    expect(copiedAnchor?.facts).not.toBe(gcmsLine.people[0].facts);
    expect(draft.lines[0].people.map((p) => p.id)).toEqual([
      "p5",
      "p4",
      "p3",
      "p2",
      "p1",
    ]);
    expect(draft.lines).toHaveLength(1);
  });

  it("carries the applicant through, and falls back when the fork drops them", () => {
    const withChild = addDescendant(gcmsLine);
    const draft: Draft = {
      ...emptyDraft(),
      lines: [withChild],
      currentLineId: "l1",
    };
    // Forking above the applicant keeps them, so they stay the subject.
    expect(forkLine(draft, "l1", "p3", "Kept")?.draft.lines[1].applicantId).toBe(
      "p1",
    );
    // Forking at the child drops the applicant, and the youngest person kept is
    // the subject of the new line, which is where the interview started from.
    expect(forkLine(draft, "l1", "p6", "Dropped")?.draft.lines[1].applicantId).toBe(
      "p6",
    );
  });

  it("returns null for a person or a line that is not there", () => {
    const draft: Draft = {
      ...emptyDraft(),
      lines: [gcmsLine],
      currentLineId: "l1",
    };
    expect(forkLine(draft, "l1", "nobody", "x")).toBeNull();
    expect(forkLine(draft, "nothing", "p1", "x")).toBeNull();
  });
});

describe("line ids", () => {
  it("never reuses an id, even after a delete", () => {
    let draft = addLine(addLine(emptyDraft(), "One"), "Two");
    draft = { ...draft, lines: [draft.lines[1]] };
    draft = addLine(draft, "Three");
    expect(draft.lines.map((l) => l.id)).toEqual(["l2", "l3"]);
  });
});
