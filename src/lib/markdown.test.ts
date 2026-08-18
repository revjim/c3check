import { describe, expect, it } from "vitest";
import { classifyChain } from "@/lib/c3";
import type { ChainResult, FactId, Person } from "@/lib/c3";
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
  DRAFT_VERSION,
  addDescendant,
  classifyLine,
  newLine,
  updatePerson,
} from "@/lib/draft";
import type { LineDraft } from "@/lib/draft";
import { humaniseDates } from "@/lib/format";
import {
  STATE_FORMAT,
  STATE_HEADING,
  looksLikeLineDocument,
  parseLineDocument,
  reportMarkdown,
} from "@/lib/markdown";
import { SOURCES } from "@/lib/sources";

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

function markdown(chain: Person[], result?: ChainResult): string {
  return reportMarkdown(result ?? classifyChain(chain), {
    generatedOn: "16 August 2026",
    lineName: "Test line",
    url: "https://example.invalid",
  });
}

/** A saved interview, as the results page would hand one over. */
function lineOf(chain: Person[], name = "Your line"): LineDraft {
  return {
    ...newLine("l1", name),
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

function documentFor(line: LineDraft): string {
  const result = classifyLine(line);
  if (result === null) throw new Error("The fixture line does not classify.");
  return reportMarkdown(result, { line, generatedOn: "16 August 2026" });
}

// ---------------------------------------------------------------------------

describe("reportMarkdown", () => {
  it("stays on a US keyboard for every fixture chain", () => {
    // The file leaves the browser and gets opened in a text editor, a word
    // processor, and whatever a lawyer's office uses. A smart quote that arrived
    // from a source string would look like a typo in all three.
    for (const { name, chain } of FIXTURES) {
      const offenders = [...new Set([...markdown(chain)])].filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code !== 10 && (code < 32 || code > 126);
      });
      expect(offenders, name).toEqual([]);
    }
  });

  it("uses no tabs anywhere", () => {
    for (const { name, chain } of FIXTURES) {
      expect(markdown(chain).includes("\t"), name).toBe(false);
    }
  });

  it("serialises identically twice", () => {
    // Nothing here reads a clock, so the same result is always the same bytes.
    for (const { name, chain } of FIXTURES) {
      expect(markdown(chain), name).toBe(markdown(chain));
    }
  });

  it("truncates nothing, and never writes an ellipsis of its own", () => {
    // Every `because` is written to be quoted as it stands.
    const result = classifyChain(gcmsChain);
    const text = markdown(gcmsChain, result);
    for (const status of result.statuses) {
      for (const trace of status.trace) {
        // Against the humanised form, because spelling an ISO date out in full
        // is the one edit the report makes to engine prose, and it is the whole
        // reason `humaniseDates` exists.
        for (const word of humaniseDates(trace.because).split(/\s+/)) {
          expect(text, `${status.label}: ${trace.provision}`).toContain(word);
        }
      }
    }
    expect(text).not.toContain("...");
  });

  it("says 'not answerable yet' rather than anything that reads like a no", () => {
    const text = markdown(unaskedAnchorChain);
    expect(classifyChain(unaskedAnchorChain).headline.verdict).toBe(
      "undetermined",
    );
    expect(text).toContain("Not answerable yet");
    expect(text.toLowerCase()).not.toContain("not a citizen");
  });

  it("carries the stop reason, and does not read as a no", () => {
    const text = markdown(withFacts(gcmsChain, "g2", { adopted: true }));
    expect(text).toContain("## Why this stops here");
    expect(text).toContain("That is not a 'no'.");
  });

  it("carries the processing pause with its ORG ID and the O-not-zero note", () => {
    const text = markdown(gcmsChain);
    expect(text).toContain("ORG ID: O182884345242");
    expect(text).toContain("capital letter O, not a zero");
    expect(text).toContain("**What you can do.**");
  });

  it("says at the top that the file is about living people", () => {
    // The one thing a downloaded copy of this can do that the page cannot: end
    // up somewhere else.
    const text = markdown(gcmsChain);
    expect(text).toContain("personal information about living people");
    expect(text).toContain("Not legal or immigration advice");
    expect(text).toContain("15 December 2025");
  });

  it("takes the date it was worked out on from the caller, never from a clock", () => {
    const text = reportMarkdown(classifyChain(modernAnchorChain), {
      generatedOn: "1 January 1999",
    });
    expect(text).toContain("Worked out on: 1 January 1999");
    expect(reportMarkdown(classifyChain(modernAnchorChain))).not.toContain(
      "Worked out on:",
    );
  });

  it("resolves every source link, to an https URL, with no bare ids", () => {
    // `sources.test.ts` guarantees the catalogue; this guarantees that what ends
    // up in the file is the link and not the id it was looked up by.
    const known = new Set(SOURCES.map((source) => source.id));
    for (const { name, chain } of FIXTURES) {
      const text = markdown(chain);
      const links = [...text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)];
      expect(links.length, name).toBeGreaterThan(0);
      for (const link of links) {
        expect(link[1].length, name).toBeGreaterThan(0);
      }
      // A `sourceId` reaching the page means `sourceById` came back empty.
      for (const id of known) {
        expect(text, `${name} printed the bare id ${id}`).not.toMatch(
          new RegExp(`Source: ${id}$`, "m"),
        );
      }
    }
  });

  it("explains the paragraphs in the line, for whoever reads it next", () => {
    const text = markdown(gcmsChain);
    expect(text).toContain("## Notes for an assistant");
    for (const provision of ["3(1)(k)", "3(1)(o)", "3(1)(q)", "3(1)(g)"]) {
      expect(text).toContain(`${provision}: `);
    }
    expect(text).toContain("state block below is authoritative");
  });
});

describe("the chain table", () => {
  it("has one row per generation, and a header", () => {
    const text = markdown(gcmsChain);
    const rows = text
      .split("\n")
      .filter((row) => row.startsWith("| ") && !row.startsWith("| ---"));
    // Five generations plus the header row.
    expect(rows).toHaveLength(6);
    expect(rows[0]).toContain("Person");
    expect(rows[5]).toContain(", you");
  });

  it("escapes a pipe in a name rather than losing the rest of the row", () => {
    // A label is whatever somebody typed, and one pipe shifts every column after
    // it for the whole table.
    const line = lineOf(gcmsChain);
    const named = updatePerson(line, "g4", {
      label: "Robert | O'Hara \\ Fictional",
    });
    const text = documentFor(named);
    const row = text
      .split("\n")
      .find((candidate) => candidate.startsWith("| ") && candidate.includes("O'Hara"));
    expect(row).toBeDefined();
    expect(row).toContain("Robert \\| O'Hara");
    // Four columns, so five pipes, and the escaped one is not one of them.
    expect((row ?? "").match(/(?<!\\)\|/g)).toHaveLength(5);
  });

  it("marks the applicant's row even where descendants follow it", () => {
    const withChild = addDescendant(lineOf(gcmsChain));
    const line = updatePerson(withChild, "p6", {
      birthDate: "2001-04-05",
      birthRegion: "outside",
      living: true,
    });
    const rows = documentFor(line)
      .split("\n")
      .filter((row) => row.startsWith("| ") && !row.startsWith("| ---"));
    expect(rows).toHaveLength(7);
    expect(rows.filter((row) => row.includes(", you"))).toHaveLength(1);
    expect(rows[5]).toContain(", you");
    expect(rows[6]).toContain("Your child");
  });
});

describe("the state block", () => {
  it("is absent, and everything else present, when no line is passed", () => {
    const text = markdown(gcmsChain);
    expect(looksLikeLineDocument(text)).toBe(false);
    expect(text).toContain("## The answer");
  });

  it("round-trips a line through a whole document", () => {
    const line = lineOf(gcmsChain, "Mother's line");
    const parsed = parseLineDocument(documentFor(line));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // `updatedAt` is a clock reading the store stamps, and is deliberately not
    // carried into a file: two downloads of one line have to be identical.
    expect(parsed.line).toEqual({ ...line, updatedAt: 0 });
    expect(classifyLine(parsed.line)?.statuses.map((s) => s.paragraph)).toEqual([
      "k",
      "o",
      "q",
      "q",
      "g",
    ]);
  });

  it("round-trips every fixture line, and every answer in it", () => {
    for (const { name, chain } of FIXTURES) {
      const line = lineOf(chain);
      const parsed = parseLineDocument(documentFor(line));
      expect(parsed.ok, name).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.line.people, name).toEqual(line.people);
      expect(parsed.line.applicantId, name).toBe(line.applicantId);
    }
  });

  it("round-trips a name carrying a pipe, a quote and three backticks", () => {
    // The fence has to be longer than anything in the data, or the block ends in
    // the middle of the JSON and the file will not parse at all.
    const label = 'Anne-Marie | O\'Hara ``` "the elder" \\';
    const line = updatePerson(lineOf(gcmsChain), "g4", { label });
    const text = documentFor(line);
    expect(text).toContain("````json");
    const parsed = parseLineDocument(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.line.people[4].label).toBe(label);
  });

  it("carries both versions, so a stale file can be told from a stale draft", () => {
    const text = documentFor(lineOf(modernAnchorChain));
    expect(text).toContain(`"format": ${STATE_FORMAT}`);
    expect(text).toContain(`"draftVersion": ${DRAFT_VERSION}`);
    expect(text).toContain("Do not edit by hand.");
  });

  it("keeps a descendant, and who the answer is about", () => {
    const withChild = addDescendant(lineOf(gcmsChain));
    const line = updatePerson(withChild, "p6", {
      birthDate: "2001-04-05",
      birthRegion: "outside",
      living: true,
    });
    const parsed = parseLineDocument(documentFor(line));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.line.people.map((person) => person.id)).toEqual([
      "g0",
      "g1",
      "g2",
      "g3",
      "g4",
      "p6",
    ]);
    expect(parsed.line.applicantId).toBe("g4");
    expect(classifyLine(parsed.line)?.applicant.personId).toBe("g4");
  });
});

describe("parseLineDocument", () => {
  it("explains itself rather than throwing, whatever it is handed", () => {
    const cases = [
      "",
      "0 HEAD\n1 SOUR Ancestry\n0 @I1@ INDI\n",
      `${STATE_HEADING}\n\nnothing here\n`,
      `${STATE_HEADING}\n\n\`\`\`json\n{not json\n\`\`\`\n`,
      `${STATE_HEADING}\n\n\`\`\`json\n{"format":1,"line":{}}\n\`\`\`\n`,
      `${STATE_HEADING}\n\n\`\`\`json\n{"format":99,"line":{"id":"l1","people":[{"id":"p1"}]}}\n\`\`\`\n`,
    ];
    for (const text of cases) {
      const parsed = parseLineDocument(text);
      expect(parsed.ok, JSON.stringify(text.slice(0, 40))).toBe(false);
      if (parsed.ok) continue;
      // A sentence for a person to read, not a code.
      expect(parsed.reason.length).toBeGreaterThan(20);
      expect(parsed.reason.endsWith(".")).toBe(true);
    }
  });

  it("drops a fact the catalogue does not have, rather than refusing the file", () => {
    // The same rule storage goes through, because it is the same validator.
    const parsed = parseLineDocument(
      `${STATE_HEADING}\n\n\`\`\`json\n${JSON.stringify({
        format: STATE_FORMAT,
        draftVersion: DRAFT_VERSION,
        line: {
          id: "l1",
          name: "Edited by hand",
          people: [{ id: "p1", facts: { adopted: true, wealthy: true } }],
        },
      })}\n\`\`\`\n`,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.line.people[0].facts)).toEqual(["adopted"]);
    // And a version 1 line, which had no applicantId at all, still restores.
    expect(parsed.line.applicantId).toBe("p1");
  });

  it("tells a c3check file from a family tree file by looking inside it", () => {
    expect(looksLikeLineDocument(documentFor(lineOf(gcmsChain)))).toBe(true);
    expect(looksLikeLineDocument("0 HEAD\n1 SOUR Ancestry\n")).toBe(false);
  });
});
