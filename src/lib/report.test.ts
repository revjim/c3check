import { describe, expect, it } from "vitest";
import { classifyChain, ruleTitleFor } from "@/lib/c3";
import type { ChainResult, Person } from "@/lib/c3";
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
import {
  chainRows,
  descendantNote,
  documentChecklist,
  groupAssumptions,
  reportText,
  verdictWord,
  wrap,
} from "@/lib/report";

const FIXTURES: { name: string; chain: Person[] }[] = [
  { name: "gcmsChain", chain: gcmsChain },
  { name: "femaleAnchorChain", chain: femaleAnchorChain },
  { name: "modernAnchorChain", chain: modernAnchorChain },
  { name: "overlapChain", chain: overlapChain },
  { name: "newfoundlandBeforeUnionChain", chain: newfoundlandBeforeUnionChain },
  { name: "newfoundlandAfterUnionChain", chain: newfoundlandAfterUnionChain },
  { name: "postCifChain", chain: postCifChain() },
  { name: "unaskedAnchorChain", chain: unaskedAnchorChain },
  { name: "stoppedChain", chain: withFacts(gcmsChain, "g2", { adopted: true }) },
];

function report(chain: Person[], result?: ChainResult): string {
  return reportText(result ?? classifyChain(chain), {
    generatedOn: "16 August 2026",
    lineName: "Test line",
    url: "https://example.invalid",
  });
}

describe("reportText", () => {
  it("stays on a US keyboard for every fixture chain", () => {
    // The report leaves the browser: it gets pasted into email, into a word
    // processor, and into a cover letter for IRCC. A smart quote that arrived
    // from a source string would survive all three and look like a typo.
    for (const { name, chain } of FIXTURES) {
      const text = report(chain);
      const offenders = [...new Set([...text])].filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code !== 10 && (code < 32 || code > 126);
      });
      expect(offenders, name).toEqual([]);
    }
  });

  it("uses no tabs anywhere", () => {
    // A tab survives a text editor and mangles in half the mail clients this
    // will be pasted into.
    for (const { name, chain } of FIXTURES) {
      expect(report(chain).includes("\t"), name).toBe(false);
    }
  });

  it("serialises identically twice", () => {
    // Nothing here reads a clock, so the same result is always the same text.
    for (const { name, chain } of FIXTURES) {
      expect(report(chain), name).toBe(report(chain));
    }
  });

  it("says 'not answerable yet' rather than 'fails' for an unresolved line", () => {
    const text = report(unaskedAnchorChain);
    expect(classifyChain(unaskedAnchorChain).headline.verdict).toBe(
      "undetermined",
    );
    expect(text).toContain("Not answerable yet");
    expect(text.toLowerCase()).not.toContain("fails");
    expect(text.toLowerCase()).not.toContain("not a citizen");
  });

  it("does not claim a paragraph for a 1946-Act citizen who has none", () => {
    // A person who simply became a citizen on 1 January 1947 and died before
    // 1977 is a citizen, and a valid (q) parent, but no paragraph of section
    // 3(1) as it now reads describes them. Rendering that as a failure would
    // be wrong twice over.
    const chain: Person[] = [
      {
        id: "g0",
        label: "G0",
        birthDate: "1900-01-01",
        birthRegion: "canada",
        deathDate: "1960-01-01",
        facts: { ceasedBritishSubject: false },
      },
    ];
    const result = classifyChain(chain);
    expect(result.applicant.outcome).toBe("qualifies");
    expect(result.applicant.paragraph).toBeNull();

    const text = report(chain, result);
    expect(text).toContain(
      "Already a citizen under the Canadian Citizenship Act then in force",
    );
    expect(text).not.toMatch(/^Paragraph: /m);
  });

  it("carries the stop reason, and does not read as a no", () => {
    const chain = withFacts(gcmsChain, "g2", { adopted: true });
    const text = report(chain);
    expect(text).toContain("WHY THIS STOPS HERE");
    expect(text).toContain("That is not a 'no'.");
  });

  it("carries the processing pause with its ORG ID and the O-not-zero note", () => {
    const result = classifyChain(gcmsChain);
    const pause = result.advisories.find((a) => a.id === "processing-pause");
    expect(pause?.orgId).toBe("O182884345242");

    const text = report(gcmsChain, result);
    expect(text).toContain("ORG ID: O182884345242");
    expect(text).toContain("capital letter O, not a zero");
    expect(text).toContain("What you can do:");
  });

  it("reproduces the published cascade in the generation list", () => {
    const text = report(gcmsChain);
    for (const paragraph of ["3(1)(k)", "3(1)(o)", "3(1)(q)", "3(1)(g)"]) {
      expect(text).toContain(`Paragraph ${paragraph}`);
    }
  });

  it("names the Act consolidation it was run against", () => {
    expect(report(modernAnchorChain)).toContain("15 December 2025");
  });

  it("does not truncate a because string", () => {
    // Those are written to be pasted into a cover letter as they stand.
    const result = classifyChain(gcmsChain);
    const matched = result.statuses[0].trace.find((t) => t.kind === "matched");
    const text = report(gcmsChain, result);
    for (const word of (matched?.because ?? "").split(/\s+/)) {
      expect(text).toContain(word);
    }
    expect(text).not.toContain("...");
  });

  it("takes the date it was generated from the caller, never from a clock", () => {
    const text = reportText(classifyChain(modernAnchorChain), {
      generatedOn: "1 January 1999",
    });
    expect(text).toContain("Worked out on: 1 January 1999");
    // With nothing passed, no date appears at all rather than today's.
    expect(reportText(classifyChain(modernAnchorChain))).not.toContain(
      "Worked out on:",
    );
  });
});

describe("chainRows", () => {
  it("gives one row per person, in chain order, compiling nothing", () => {
    const result = classifyChain(gcmsChain);
    const rows = chainRows(result);
    expect(rows.map((row) => row.personId)).toEqual(
      result.statuses.map((status) => status.personId),
    );
    expect(rows.map((row) => row.person)).toEqual([
      "G0 (G0)",
      "G1 (G1)",
      "G2 (G2)",
      "G3 (G3)",
      "G4 (G4)",
    ]);
    expect(rows.map((row) => row.paragraph)).toEqual([
      "3(1)(k)",
      "3(1)(o)",
      "3(1)(q)",
      "3(1)(q)",
      "3(1)(g)",
    ]);
  });

  it("marks exactly one row as the applicant, wherever they are", () => {
    for (const { name, chain } of FIXTURES) {
      const rows = chainRows(classifyChain(chain));
      expect(rows.filter((row) => row.isApplicant), name).toHaveLength(1);
      expect(rows[rows.length - 1].isApplicant, name).toBe(true);
    }
    // With a child in the line, the marked row is no longer the last one.
    const withChild = classifyChain(postCifChain({ presenceDaysInCanada: 1095 }), {
      applicantIndex: 1,
    });
    const rows = chainRows(withChild);
    expect(rows.map((row) => row.isApplicant)).toEqual([false, true, false]);
  });

  it("says why in the paragraph's own words", () => {
    const rows = chainRows(classifyChain(gcmsChain));
    // The reason for a classification is what the paragraph says, so the column
    // quotes the rule table rather than restating it in different words.
    expect(rows[0].why).toBe(ruleTitleFor("k"));
    expect(rows[0].why.length).toBeGreaterThan(20);
  });

  it("names what set the effective date, or why there is none", () => {
    const rows = chainRows(classifyChain(gcmsChain));
    expect(rows[0].citizenAsOf).toContain("1 January 1947");
    expect(rows[0].citizenAsOf).toContain("via 3(7)");
    // Where a subsection of 3(7) sets the date, that subsection is what the
    // column names, even for a paragraph whose date is the birth itself.
    expect(rows[4].citizenAsOf).toBe("8 August 1970, via 3(7)(e)");

    const undetermined = chainRows(classifyChain(unaskedAnchorChain));
    expect(undetermined[0].citizenAsOf).toBe("Not answerable yet");
    // Never anything that reads like a denial for a person who is simply not
    // answerable yet.
    for (const row of undetermined) {
      expect(row.citizenAsOf.toLowerCase()).not.toContain("not a citizen");
    }
  });

  it("never claims a paragraph, or a failure, for a 1946-Act citizen", () => {
    const result = classifyChain([
      {
        id: "g0",
        label: "G0",
        birthDate: "1900-01-01",
        birthRegion: "canada",
        deathDate: "1960-01-01",
        facts: { ceasedBritishSubject: false },
      },
    ]);
    const [row] = chainRows(result);
    expect(row.paragraphIsProvision).toBe(false);
    expect(row.paragraph).toBe("Canadian Citizenship Act, 1946");
    expect(row.citizenAsOf).toContain("1 January 1947");
    expect(row.why.toLowerCase()).not.toContain("no paragraph of section 3(1) describes");
  });

  it("marks a precedence loss and a halt rather than hiding them", () => {
    const overlap = chainRows(classifyChain(overlapChain));
    expect(overlap[1].paragraph).toBe("3(1)(o)");
    expect(overlap[1].note).toContain("also described by paragraph 3(1)(q)");
    expect(overlap[1].note).toContain("lost on precedence");

    const stopped = chainRows(
      classifyChain(withFacts(gcmsChain, "g2", { adopted: true })),
    );
    expect(stopped[2].note).toContain("stops here");
    expect(stopped[2].paragraph).toBe("Not worked out");
  });
});

describe("descendantNote", () => {
  it("says nothing at all for a line that ends at the applicant", () => {
    for (const { name, chain } of FIXTURES) {
      expect(descendantNote(classifyChain(chain)), name).toBeNull();
    }
  });

  it("speaks up where a descendant's answer differs from the applicant's", () => {
    const result = classifyChain(postCifChain({ presenceDaysInCanada: 40 }), {
      applicantIndex: 1,
    });
    expect(result.statuses[2].outcome).toBe("fails");
    expect(descendantNote(result)).toBe("G2 does not come out the same way as G1.");
  });

  it("stays quiet where the descendant lands in the same place", () => {
    // The child of a (b) born before the coming into force is a (b) too, and
    // repeating the headline at somebody who has read it is noise.
    const result = classifyChain(
      [
        { id: "g0", label: "G0", birthDate: "1960-05-04", birthRegion: "canada" },
        { id: "g1", label: "G1", birthDate: "1990-01-20", birthRegion: "outside" },
        { id: "g2", label: "G2", birthDate: "2015-01-20", birthRegion: "outside" },
      ],
      { applicantIndex: 1 },
    );
    expect(result.statuses.map((s) => s.paragraph)).toEqual(["d", "b", "b"]);
    expect(descendantNote(result)).toBeNull();
  });
});

describe("documentChecklist", () => {
  it("groups by person, in chain order", () => {
    const result = classifyChain(unaskedAnchorChain);
    const checklist = documentChecklist(result);
    expect(checklist.map((group) => group.personId)).toEqual(
      checklist.map((group) => group.personId).sort((a, b) => a.localeCompare(b)),
    );
    expect(checklist[0].label).toBe("G0");
  });

  it("deduplicates a document shared by two facts about the same person", () => {
    // residence-on-pivot-date is named by three separate facts, so an ancestor
    // with more than one of them open would otherwise list the same census
    // return three times.
    const result = classifyChain(
      withFacts(overlapChain, "g1", {
        livedInCanadaOrNewfoundland: true,
        britishSubjectOnPivot: undefined,
        ordinarilyResidentOnPivot: undefined,
      }),
    );
    for (const group of documentChecklist(result)) {
      expect(new Set(group.documents).size, group.label).toBe(
        group.documents.length,
      );
    }
  });

  it("leaves out a person with nothing outstanding", () => {
    const checklist = documentChecklist(classifyChain(unaskedAnchorChain));
    expect(checklist.every((group) => group.documents.length > 0)).toBe(true);
  });

  it("names something to find for every fact the engine could not settle", () => {
    // "We cannot answer this" is half an answer, and the useful half is the
    // other one.
    for (const { name, chain } of FIXTURES) {
      const result = classifyChain(chain);
      if (result.missing.length === 0) continue;
      const documents = documentChecklist(result).flatMap((g) => g.documents);
      expect(documents.length, name).toBeGreaterThan(0);
    }
  });
});

describe("groupAssumptions", () => {
  it("separates what carries the answer from what does not", () => {
    const result = classifyChain(gcmsChain);
    const groups = groupAssumptions(result, () => false);
    expect(groups.decisive.length).toBeGreaterThan(0);
    expect(groups.immaterial.length).toBeGreaterThan(0);
    expect(groups.confirmed).toEqual([]);
    expect(
      groups.decisive.length + groups.confirmed.length + groups.immaterial.length,
    ).toBe(result.assumptions.length);
  });

  it("moves an assumption the user looked at into 'confirmed'", () => {
    // The distinction the results page badges: "we assumed this" against "you
    // confirmed this". Worth having, and worth not losing.
    const result = classifyChain(gcmsChain);
    const groups = groupAssumptions(
      result,
      (_personId, factId) => factId === "adopted",
    );
    expect(groups.confirmed.every((a) => a.factId === "adopted")).toBe(true);
    expect(groups.decisive.every((a) => a.factId !== "adopted")).toBe(true);
  });
});

describe("words", () => {
  it("never renders undetermined as a negative", () => {
    expect(verdictWord("undetermined")).toBe("Not answerable yet");
  });
});

describe("wrap", () => {
  it("breaks on spaces and never mid-word", () => {
    const lines = wrap("one two three four five", 9);
    expect(lines).toEqual(["one two", "three", "four five"]);
  });

  it("leaves a word longer than the width alone rather than cutting it", () => {
    expect(wrap("supercalifragilistic", 5)).toEqual(["supercalifragilistic"]);
  });

  it("gives one empty line for empty text", () => {
    expect(wrap("", 10)).toEqual([""]);
  });
});
