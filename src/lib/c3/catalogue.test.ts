/**
 * Integrity checks on the data tables.
 *
 * These are the tests that catch a typo in an ORG ID, a rule citing a source
 * that does not exist, or a fact added to the catalogue with no way to answer
 * it. None of them exercises the classifier; all of them fail loudly if the
 * tables and the rest of the engine drift apart.
 */

import { describe, expect, it } from "vitest";
import { SOURCES } from "@/lib/sources";
import { classifyChain } from "@/lib/c3/classify";
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
import { ACT_1947, NFLD_UNION } from "@/lib/c3/dates";
import { DEEMING, effectiveDateFor } from "@/lib/c3/deeming";
import { DOCUMENTS } from "@/lib/c3/documents";
import { FACTS, FACTS_WITHOUT_DEFAULTS, documentsFor, questionFor } from "@/lib/c3/facts";
import { ALL_ORG_IDS, PROCESSING_PAUSE_ORG_ID, orgIdFor } from "@/lib/c3/orgIds";
import { TIE_BREAK_ORDER, outranks, resolvePrecedence } from "@/lib/c3/precedence";
import { RULES } from "@/lib/c3/rules";
import { CLASSIFIED_PARAGRAPHS } from "@/lib/c3/types";
import type { FactId, Paragraph } from "@/lib/c3/types";

const SOURCE_IDS = new Set(SOURCES.map((s) => s.id));

describe("rules", () => {
  it("covers exactly the paragraphs v1 claims to classify", () => {
    expect(RULES.map((r) => r.paragraph).sort()).toEqual(
      [...CLASSIFIED_PARAGRAPHS].sort(),
    );
  });

  it("cites a source that actually exists for every rule", () => {
    for (const rule of RULES) {
      expect(SOURCE_IDS.has(rule.sourceId), rule.provision).toBe(true);
    }
  });

  it("gives every rule a distinct paragraph and a matching provision", () => {
    const seen = new Set<Paragraph>();
    for (const rule of RULES) {
      expect(seen.has(rule.paragraph), rule.provision).toBe(false);
      seen.add(rule.paragraph);
      expect(rule.provision).toBe(`3(1)(${rule.paragraph})`);
    }
  });
});

describe("citations in actual output", () => {
  // Checking `rule.sourceId` is not enough: bars, the first-generation limit,
  // precedence and the advisory layer all emit citations of their own, and a
  // stale id there is invisible until someone clicks a dead reference.
  const everyChain = [
    gcmsChain,
    femaleAnchorChain,
    modernAnchorChain,
    newfoundlandBeforeUnionChain,
    newfoundlandAfterUnionChain,
    overlapChain,
    unaskedAnchorChain,
    postCifChain({ presenceDaysInCanada: 400 }),
    postCifChain(),
    withFacts(gcmsChain, "g0", { declarationOfAlienage: true }),
    withFacts(gcmsChain, "g2", { adopted: true }),
    withFacts(gcmsChain, "g4", {
      citizenshipByGrant: true,
      renouncedCitizenship: true,
    }),
  ];

  const cited = new Set<string>();
  for (const chain of everyChain) {
    const result = classifyChain(chain);
    for (const status of result.statuses) {
      for (const t of status.trace) cited.add(t.sourceId);
      for (const f of status.flags) cited.add(f.sourceId);
      if (status.stopReason !== null) cited.add(status.stopReason.sourceId);
    }
    for (const a of result.advisories) cited.add(a.sourceId);
  }

  it("cites only sources that exist", () => {
    for (const id of cited) {
      expect(SOURCE_IDS.has(id), `cited but not in SOURCES: ${id}`).toBe(true);
    }
  });

  it("attributes the (o)-over-(q) tie-break to the thread it came from", () => {
    // Empirical, not statutory, so it must not appear to rest on the statute.
    const g1 = classifyChain(gcmsChain).statuses[1];
    const tieBreak = g1.trace.find((t) => t.provision === "tie-break");
    expect(tieBreak?.sourceId).toBe("canadianbydescent-gcms-thread");
  });

  it("actually exercises enough of the engine to be worth having", () => {
    // Guards against the set above quietly narrowing to nothing.
    expect(cited.size).toBeGreaterThanOrEqual(4);
  });
});

describe("the 3(7) deeming map", () => {
  it("has an entry for every paragraph of 3(1)", () => {
    for (const rule of RULES) {
      expect(DEEMING[rule.paragraph], rule.provision).toBeDefined();
    }
  });

  it("maps the four retroactive pairs to the right dates and subparagraphs", () => {
    expect(DEEMING.k).toMatchObject({ provision: "3(7)(j)" });
    expect(DEEMING.m).toMatchObject({ provision: "3(7)(j)" });
    expect(DEEMING.o).toMatchObject({ provision: "3(7)(k)" });
    expect(DEEMING.q).toMatchObject({ provision: "3(7)(k)" });
    expect(DEEMING.l).toMatchObject({ provision: "3(7)(l)" });
    expect(DEEMING.n).toMatchObject({ provision: "3(7)(l)" });
    expect(DEEMING.p).toMatchObject({ provision: "3(7)(m)" });
    expect(DEEMING.r).toMatchObject({ provision: "3(7)(m)" });

    expect(effectiveDateFor("k", "1880-01-01")).toBe(ACT_1947);
    expect(effectiveDateFor("q", "1930-01-01")).toBe(ACT_1947);
    expect(effectiveDateFor("l", "1930-01-01")).toBe(NFLD_UNION);
    expect(effectiveDateFor("r", "1940-01-01")).toBe(NFLD_UNION);
  });

  it("deems (b), (g) and (h) effective from birth", () => {
    expect(DEEMING.b.provision).toBe("3(7)(h)");
    expect(DEEMING.g.provision).toBe("3(7)(e)");
    expect(DEEMING.h.provision).toBe("3(7)(e)");
    expect(effectiveDateFor("g", "1970-08-08")).toBe("1970-08-08");
  });

  it("never cites a 3(7)(i), because there is no longer one", () => {
    // 3(7) runs (a) to (h), then (j) to (m), paragraph (i) was repealed by
    // S.C. 2025, c. 5, s. 1. A citation to 3(7)(i) is always a bug.
    const cited = Object.values(DEEMING)
      .map((d) => d.provision)
      .filter((p): p is string => p !== null);
    expect(cited.some((p) => p.includes("3(7)(i)"))).toBe(false);
  });
});

describe("the fact catalogue", () => {
  it("keys every entry by its own id", () => {
    for (const [id, entry] of Object.entries(FACTS)) {
      expect(entry.id).toBe(id);
    }
  });

  it("gives every fact a question, a reason and a document set", () => {
    for (const entry of Object.values(FACTS)) {
      expect(entry.question.length, entry.id).toBeGreaterThan(0);
      expect(entry.why.length, entry.id).toBeGreaterThan(0);
      expect(DOCUMENTS[entry.documents], entry.id).toBeDefined();
      expect(documentsFor(entry.id).length, entry.id).toBeGreaterThan(0);
    }
  });

  it("makes every default statable in words", () => {
    // A default nobody can read is a default nobody can override.
    for (const entry of Object.values(FACTS)) {
      if (entry.defaultWhenUnasked === undefined) continue;
      expect(entry.defaultStatement, entry.id).toBeTruthy();
    }
  });

  it("leaves exactly the four facts with no safe default undefaulted", () => {
    // Widening this set silently is how a tool starts guessing. Narrowing it is
    // how a tool starts refusing to answer anything.
    expect([...FACTS_WITHOUT_DEFAULTS].sort()).toEqual(
      [
        "britishSubjectOnPivot",
        "ceasedBritishSubject",
        "ordinarilyResidentOnPivot",
        "presenceDaysInCanada",
      ].sort() as FactId[],
    );
  });

  it("addresses the question to the person being asked about", () => {
    expect(questionFor("adopted", "Grandmother")).toBe(
      "Was Grandmother adopted?",
    );
  });

  it("leaves no document set orphaned", () => {
    const used = new Set(Object.values(FACTS).map((f) => f.documents));
    const unused = Object.keys(DOCUMENTS).filter(
      (key) => !used.has(key as keyof typeof DOCUMENTS),
    );
    // `date-of-death` is used by the engine directly, not through a fact.
    expect(unused).toEqual(["date-of-death"]);
  });
});

describe("the ORG ID table", () => {
  it("begins every ID with a capital letter O, not a zero", () => {
    // The ATIP text layer is OCR and renders these with a leading `0`; the page
    // image does not. Getting it wrong sends someone to a nonexistent queue.
    for (const org of ALL_ORG_IDS) {
      expect(org.id, org.name).toMatch(/^O\d{12}$/);
    }
    expect(PROCESSING_PAUSE_ORG_ID).toMatch(/^O\d{12}$/);
  });

  it("has no duplicate IDs", () => {
    const ids = ALL_ORG_IDS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits (b) by birth date the way the table does", () => {
    expect(orgIdFor("b", 2, "1980-01-01")?.id).toBe("O181359896802");
    expect(orgIdFor("b", 2, "2009-04-17")?.id).toBe("O181363773548");
    expect(orgIdFor("b", 2, "2025-12-14")?.id).toBe("O181363773548");
    expect(orgIdFor("b", 2, "2025-12-15")?.id).toBe("O181367938988");
  });

  it("assigns nothing below the second generation abroad", () => {
    // Every row in the table is qualified by "Born in Generation 2+ abroad".
    expect(orgIdFor("g", 1, "1970-08-08")).toBeNull();
    expect(orgIdFor("g", 2, "1970-08-08")?.id).toBe("O181367939516");
  });

  it("assigns nothing to the paragraphs the release has no row for", () => {
    for (const paragraph of ["a", "d", "k", "l", "m", "n", "o", "p"] as Paragraph[]) {
      expect(orgIdFor(paragraph, 3, "1930-01-01"), paragraph).toBeNull();
    }
  });
});

describe("precedence", () => {
  it("orders every paragraph, so the tie-break is total", () => {
    const ranked = new Set(TIE_BREAK_ORDER);
    expect(ranked.size).toBe(TIE_BREAK_ORDER.length);
    for (const rule of RULES) {
      expect(ranked.has(rule.paragraph), rule.provision).toBe(true);
    }
  });

  it("applies 3(6.3) as a rule, not as a preference", () => {
    const result = resolvePrecedence(["m", "o"]);
    expect(result.winner).toBe("o");
    expect(result.traces[0].provision).toBe("3(6.3)");
  });

  it("applies 3(6.4) so that (b) yields to (f)", () => {
    // Moot while (f) is detect-and-stop, but the ATIP contradicts itself on this
    // point: p. 22 says (b), p. 33 says (f), so the statute is pinned here.
    const result = resolvePrecedence(["b", "f"]);
    expect(result.winner).toBe("f");
    expect(result.traces.some((t) => t.provision === "3(6.4)")).toBe(true);
  });

  it("prefers (o) to (q), and records that the choice is empirical", () => {
    const result = resolvePrecedence(["o", "q"]);
    expect(result.winner).toBe("o");
    expect(result.alternatives).toEqual(["q"]);
    expect(outranks("o", "q")).toBe(true);
    expect(result.traces.some((t) => t.because.includes("GCMS"))).toBe(true);
  });

  it("returns nothing for nothing", () => {
    expect(resolvePrecedence([]).winner).toBeNull();
  });
});
