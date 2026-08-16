import { describe, expect, it } from "vitest";
import { classifyChain } from "@/lib/c3/classify";
import {
  femaleAnchorChain,
  gcmsChain,
  modernAnchorChain,
  newfoundlandAfterUnionChain,
  newfoundlandBeforeUnionChain,
  overlapChain,
  unaskedAnchorChain,
  withFacts,
} from "@/lib/c3/fixtures";
import type { Paragraph, Person } from "@/lib/c3/types";

const paragraphs = (people: Person[]): (Paragraph | null)[] =>
  classifyChain(people).statuses.map((s) => s.paragraph);

const outcomes = (people: Person[]): string[] =>
  classifyChain(people).statuses.map((s) => s.outcome);

describe("the published GCMS chain", () => {
  // The only end-to-end check against a known-correct IRCC classification that
  // exists. If this breaks, the engine is wrong, not the test.
  it("reproduces k → o → q → q → g", () => {
    expect(paragraphs(gcmsChain)).toEqual(["k", "o", "q", "q", "g"]);
  });

  it("classifies every generation, not just the applicant", () => {
    expect(outcomes(gcmsChain)).toEqual(Array(5).fill("qualifies"));
  });

  it("puts the anchor and the two (q)s at 1 January 1947, and the (g) at birth", () => {
    const dates = classifyChain(gcmsChain).statuses.map((s) => s.effectiveDate);
    expect(dates).toEqual([
      "1947-01-01",
      "1947-01-01",
      "1947-01-01",
      "1947-01-01",
      "1970-08-08",
    ]);
  });

  it("cites the right deeming provision for each generation", () => {
    const deeming = classifyChain(gcmsChain).statuses.map(
      (s) => s.deemingProvision,
    );
    expect(deeming).toEqual([
      "3(7)(j)",
      "3(7)(k)",
      "3(7)(k)",
      "3(7)(k)",
      "3(7)(e)",
    ]);
  });

  it("prefers (o) over (q) for the first generation abroad, and says why", () => {
    const g1 = classifyChain(gcmsChain).statuses[1];
    expect(g1.paragraph).toBe("o");
    expect(g1.alternatives).toContain("q");
    const tieBreak = g1.trace.find((t) => t.provision === "tie-break");
    expect(tieBreak?.because).toMatch(/k → o → q → q/);
  });

  it("does not make the 1942-style birth a (g) — the parent was not yet a citizen", () => {
    const g3 = classifyChain(gcmsChain).statuses[3];
    expect(g3.paragraph).toBe("q");
    const notG = g3.trace.find(
      (t) => t.provision === "3(1)(g)" && t.kind === "not-matched",
    );
    expect(notG?.because).toMatch(/deemed a citizen as of 1 January 1947/);
  });

  it("routes the applicant to the ORG ID IRCC would use", () => {
    const result = classifyChain(gcmsChain);
    expect(result.applicant.orgId?.id).toBe("O181367939516");
    expect(result.statuses[2].orgId?.id).toBe("O181369686362");
  });

  it("carries the (o) claim past a parent who died before the deeming date", () => {
    const g1 = classifyChain(gcmsChain).statuses[1];
    expect(g1.trace.some((t) => t.provision === "3(1.2)")).toBe(true);
  });

  it("leads with a headline that carries its own uncertainty", () => {
    const { headline } = classifyChain(gcmsChain);
    expect(headline.verdict).toBe("qualifies");
    expect(headline.paragraph).toBe("g");
    expect(headline.confidence).toBe("flagged");
    expect(headline.summary).toMatch(/3\(1\)\(g\)/);
  });
});

describe("the female-anchor variant", () => {
  it("produces the same cascade from a different losing event", () => {
    expect(paragraphs(femaleAnchorChain)).toEqual(["k", "o", "q", "q", "g"]);
  });
});

describe("a modern anchor", () => {
  it("makes someone born in Canada in 1960 a (d), not a (k)", () => {
    const [g0] = classifyChain(modernAnchorChain).statuses;
    expect(g0.paragraph).toBe("d");
    expect(g0.effectiveDate).toBe("1960-05-04");
    expect(g0.alternatives).toEqual([]);
  });

  it("makes the child born abroad in 1990 a (b) from birth", () => {
    const g1 = classifyChain(modernAnchorChain).statuses[1];
    expect(g1.paragraph).toBe("b");
    expect(g1.effectiveDate).toBe("1990-01-20");
    expect(g1.deemingProvision).toBe("3(7)(h)");
  });

  it("does not attach an ORG ID in the first generation abroad", () => {
    expect(classifyChain(modernAnchorChain).statuses[1].orgId).toBeNull();
  });
});

describe("born in Canada under the current Act", () => {
  const chain: Person[] = [
    { id: "g0", label: "G0", birthDate: "1985-06-01", birthRegion: "canada" },
  ];

  it("is an (a), effective from birth and citing no deeming provision", () => {
    const [g0] = classifyChain(chain).statuses;
    expect(g0.paragraph).toBe("a");
    expect(g0.effectiveDate).toBe("1985-06-01");
    // 3(7) has no rule for (a) — the paragraph operates at the moment of birth.
    expect(g0.deemingProvision).toBeNull();
  });

  it("gives way to subsection 3(2) for the child of a foreign diplomat", () => {
    const diplomat = withFacts(chain, "g0", { foreignDiplomatParent: true });
    const [g0] = classifyChain(diplomat).statuses;
    expect(g0.outcome).toBe("fails");
    expect(
      g0.trace.some((t) => t.provision === "3(1)(a)" && t.because.includes("3(2)")),
    ).toBe(true);
  });

  it("cites no deeming provision for a (d) either", () => {
    // The map records 3(7)(b) against (d), but that subparagraph reaches only a
    // (d) who lost citizenship by grant and resumed it.
    const [g0] = classifyChain(modernAnchorChain).statuses;
    expect(g0.paragraph).toBe("d");
    expect(g0.deemingProvision).toBeNull();
  });
});

describe("a citizen the current Act does not describe", () => {
  // Someone born in Canada before 1947 who kept British subject status became a
  // citizen on 1 January 1947 under the 1946 Act. If they died before 1977 they
  // are not a (d), and no other paragraph reaches them — but they were a
  // citizen, and paragraph (q) names exactly this person as a parent.
  const chain: Person[] = [
    {
      id: "g0",
      label: "G0",
      birthDate: "1900-04-04",
      birthRegion: "canada",
      deathDate: "1960-02-02",
      facts: { ceasedBritishSubject: false },
    },
    { id: "g1", label: "G1", birthDate: "1930-05-05", birthRegion: "outside" },
  ];

  it("records them as a citizen with no paragraph", () => {
    const [g0] = classifyChain(chain).statuses;
    expect(g0.outcome).toBe("qualifies");
    expect(g0.paragraph).toBeNull();
    expect(g0.effectiveDate).toBe("1947-01-01");
    expect(g0.became1947ActCitizen).toBe(true);
  });

  it("makes their child abroad a (q) on the literal reading of the parent test", () => {
    const g1 = classifyChain(chain).statuses[1];
    expect(g1.paragraph).toBe("q");
    const matched = g1.trace.find(
      (t) => t.provision === "3(1)(q)" && t.kind === "matched",
    );
    expect(matched?.because).toMatch(
      /a parent who became a citizen on 1947-01-01 under the Canadian Citizenship Act/,
    );
  });

  it("keeps the same person a (d) if they lived past 1977", () => {
    const lived = chain.map((p) =>
      p.id === "g0" ? { ...p, deathDate: undefined } : p,
    );
    expect(paragraphs(lived)).toEqual(["d", "q"]);
  });
});

describe("3(6.3)", () => {
  it("resolves an (m)-and-(o) overlap to (o)", () => {
    const g1 = classifyChain(overlapChain).statuses[1];
    expect(g1.paragraph).toBe("o");
    const superseded = g1.trace.find((t) => t.provision === "3(6.3)");
    expect(superseded?.kind).toBe("superseded");
    expect(superseded?.because).toMatch(/\(m\)/);
  });

  it("keeps (m) visible as an alternative rather than silently dropping it", () => {
    const g1 = classifyChain(overlapChain).statuses[1];
    expect(g1.trace.some((t) => t.provision === "3(1)(m)" && t.kind === "matched")).toBe(
      true,
    );
  });

  it("flags the (m) judgment call even though (m) lost", () => {
    const g1 = classifyChain(overlapChain).statuses[1];
    expect(g1.flags.map((f) => f.id)).toContain("judgment-call");
  });
});

describe("Newfoundland", () => {
  it("routes a pre-union birth to the (l)/(p) track, not (k)/(o)", () => {
    const statuses = classifyChain(newfoundlandBeforeUnionChain).statuses;
    expect(statuses.map((s) => s.paragraph)).toEqual(["l", "p"]);
    expect(statuses.map((s) => s.effectiveDate)).toEqual([
      "1949-04-01",
      "1949-04-01",
    ]);
    expect(statuses.map((s) => s.deemingProvision)).toEqual([
      "3(7)(l)",
      "3(7)(m)",
    ]);
  });

  it("prefers (p) over (r), mirroring the (o)-over-(q) decision", () => {
    const g1 = classifyChain(newfoundlandBeforeUnionChain).statuses[1];
    expect(g1.paragraph).toBe("p");
    expect(g1.alternatives).toContain("r");
  });

  it("keeps the (m) and (n) tracks apart, though one fact names them both", () => {
    const person: Person[] = [
      {
        id: "g0",
        label: "G0",
        birthDate: "1910-01-01",
        birthRegion: "outside",
        deathDate: "1990-01-01",
        facts: {
          livedInCanadaOrNewfoundland: true,
          britishSubjectOnPivot: true,
          ordinarilyResidentOnPivot: true,
          canadianDomicileOnPivot: false,
          residentInNewfoundland: true,
        },
      },
    ];
    const [g0] = classifyChain(person).statuses;
    expect(g0.paragraph).toBe("n");
    expect(g0.effectiveDate).toBe("1949-04-01");
    expect(g0.alternatives).toEqual([]);
  });

  it("raises the excluded-cohort flag for consecutive (r)s as well as (q)s", () => {
    const chain: Person[] = [
      {
        id: "g0",
        label: "G0",
        birthDate: "1920-01-01",
        birthRegion: "newfoundland",
        facts: {
          ceasedBritishSubject: false,
          // Asked because a Newfoundlander living in Canada on 1 January 1947
          // is an (m) in their own right, which would outrank the (d).
          britishSubjectOnPivot: true,
          ordinarilyResidentOnPivot: false,
        },
      },
      { id: "g1", label: "G1", birthDate: "1935-01-01", birthRegion: "outside" },
      { id: "g2", label: "G2", birthDate: "1945-01-01", birthRegion: "outside" },
    ];
    const statuses = classifyChain(chain).statuses;
    expect(statuses.map((s) => s.paragraph)).toEqual(["d", "r", "r"]);
    expect(statuses[2].flags.map((f) => f.id)).toContain("consecutive-q");
    expect(statuses[2].flags.find((f) => f.id === "consecutive-q")?.title).toMatch(
      /\(r\)/,
    );
  });

  it("treats a post-union Newfoundland birth as a birth in Canada", () => {
    const statuses = classifyChain(newfoundlandAfterUnionChain).statuses;
    expect(statuses[0].paragraph).toBe("d");
    expect(statuses[1].paragraph).toBe("b");
  });
});

describe("undetermined", () => {
  it("names the fact and the documents rather than guessing", () => {
    const result = classifyChain(unaskedAnchorChain);
    const [g0] = result.statuses;

    expect(g0.outcome).toBe("undetermined");
    expect(g0.paragraph).toBeNull();

    const gap = g0.missing.find((m) => m.factId === "ceasedBritishSubject");
    expect(gap).toBeDefined();
    expect(gap?.question).toMatch(/G0/);
    expect(gap?.documents.join(" ")).toMatch(/naturalisation certificate/i);
  });

  it("propagates down the line instead of denying the descendant", () => {
    const result = classifyChain(unaskedAnchorChain);
    expect(result.statuses[1].outcome).toBe("undetermined");
    expect(result.headline.verdict).toBe("undetermined");
    expect(result.headline.confidence).toBe("unknown");
  });

  it("resolves once the fact is supplied", () => {
    const answered = withFacts(unaskedAnchorChain, "g0", {
      ceasedBritishSubject: true,
    });
    expect(paragraphs(answered)).toEqual(["k", "o"]);
  });

  it("does not report a fact that could not have changed the answer", () => {
    // G1 did live in Canada, so the (m) branch opens and nobody has been asked
    // whether they were a British subject there in 1947. It stays open — but
    // 3(6.3) would supersede (m) either way, so it is a footnote, not a gap.
    const chain = withFacts(gcmsChain, "g1", {
      livedInCanadaOrNewfoundland: true,
    });
    const g1 = classifyChain(chain).statuses[1];
    expect(g1.paragraph).toBe("o");
    expect(g1.trace.some((t) => t.provision === "3(1)(m)" && t.kind === "unknown")).toBe(
      true,
    );
    expect(g1.outcome).toBe("qualifies");
    expect(g1.missing).toEqual([]);
    expect(
      g1.trace.some((t) => t.kind === "note" && t.because.includes("could not have changed")),
    ).toBe(true);
  });
});

describe("assumptions", () => {
  it("applies a default and reports it, never silently", () => {
    const result = classifyChain(gcmsChain);
    const alienage = result.assumptions.find(
      (a) => a.factId === "declarationOfAlienage" && a.personId === "g0",
    );
    expect(alienage).toBeDefined();
    expect(alienage?.statement).toMatch(/assumed not to have made a declaration/);
    expect(alienage?.documents.length).toBeGreaterThan(0);
  });

  it("says when it assumed someone was still alive", () => {
    const result = classifyChain(modernAnchorChain);
    const alive = result.assumptions.find(
      (a) => a.factId === null && a.personId === "g0",
    );
    expect(alive?.statement).toMatch(/no date of death/);
  });

  it("lets an assumption be overridden, and the answer changes", () => {
    const overridden = withFacts(gcmsChain, "g0", {
      declarationOfAlienage: true,
    });
    expect(outcomes(overridden)[0]).toBe("fails");
  });
});

describe("detect and stop", () => {
  it("stops at an adoption and points at section 5.1", () => {
    const adopted = withFacts(gcmsChain, "g2", { adopted: true });
    const result = classifyChain(adopted);

    expect(result.statuses[2].outcome).toBe("stopped");
    expect(result.statuses[2].stopReason?.id).toBe("adoption");
    expect(result.statuses[2].stopReason?.provision).toMatch(/5\.1/);
  });

  it("stops everything below the adoption too", () => {
    const result = classifyChain(withFacts(gcmsChain, "g2", { adopted: true }));
    expect(result.statuses.map((s) => s.outcome)).toEqual([
      "qualifies",
      "qualifies",
      "stopped",
      "stopped",
      "stopped",
    ]);
    expect(result.statuses[3].stopReason?.id).toBe("ancestor-stopped");
  });

  it("stops at a loss-and-restoration event and names the paragraphs", () => {
    const result = classifyChain(
      withFacts(gcmsChain, "g3", { lostAndRestored: true }),
    );
    const g3 = result.statuses[3];
    expect(g3.outcome).toBe("stopped");
    expect(g3.stopReason?.id).toBe("loss-and-restoration");
    expect(g3.stopReason?.provision).toBe("3(1)(f), (h), (i), (j)");
  });

  it("stops for someone who already holds citizenship by grant", () => {
    const result = classifyChain(
      withFacts(gcmsChain, "g4", { citizenshipByGrant: true }),
    );
    expect(result.applicant.stopReason?.id).toBe("citizen-by-grant");
    expect(result.headline.verdict).toBe("stopped");
  });

  it("does not stop for a grant that was renounced — the bars deal with that", () => {
    const result = classifyChain(
      withFacts(gcmsChain, "g4", {
        citizenshipByGrant: true,
        renouncedCitizenship: true,
      }),
    );
    expect(result.applicant.outcome).not.toBe("stopped");
  });
});

describe("the advisory layer", () => {
  it("raises the processing pause for the GCMS chain and says how to break it", () => {
    const pause = classifyChain(gcmsChain).advisories.find(
      (a) => a.id === "processing-pause",
    );
    expect(pause?.orgId).toBe("O182884345242");
    expect(pause?.action).toMatch(/certificate/i);
  });

  it("drops the pause once the remedied ancestor holds a certificate", () => {
    const withCertificates = ["g0", "g1", "g2"].reduce(
      (chain, id) => withFacts(chain, id, { certificateIssued: true }),
      gcmsChain,
    );
    const advisories = classifyChain(withCertificates).advisories;
    expect(advisories.find((a) => a.id === "processing-pause")).toBeUndefined();
  });

  it("flags consecutive (q)s as the cohort IRCC has set aside", () => {
    const result = classifyChain(gcmsChain);
    expect(result.statuses[3].flags.map((f) => f.id)).toContain("consecutive-q");
    expect(
      result.advisories.some((a) => a.id === "excluded-cohort-consecutive-q"),
    ).toBe(true);
  });

  it("flags an ancestor who died before the amendment that remedied them", () => {
    const result = classifyChain(gcmsChain);
    const g0 = result.statuses[0];
    expect(g0.remediedBy).toBe("c-24");
    expect(g0.flags.map((f) => f.id)).toContain("cohort-2-death");
  });

  it("flags a claim running through more than two deceased generations", () => {
    const threeDead = ["g2", "g3"].reduce(
      (chain, id) => withFacts(chain, id, {}),
      gcmsChain,
    ).map((p) =>
      p.id === "g2"
        ? { ...p, deathDate: "1999-01-01" }
        : p.id === "g3"
          ? { ...p, deathDate: "2005-01-01" }
          : p,
    );
    const result = classifyChain(threeDead);
    expect(result.flags.map((f) => f.id)).toContain("s1_5-reach");
  });

  it("does not flag a reach that 3(1.5) actually covers", () => {
    // Two consecutive deceased generations is exactly what the subsection says.
    const result = classifyChain(gcmsChain);
    expect(result.flags.map((f) => f.id)).not.toContain("s1_5-reach");
  });

  it("flags the first-generation reading only where it could bite", () => {
    const result = classifyChain(gcmsChain);
    // G1 is the first generation abroad: statute and guidance agree there.
    expect(result.statuses[1].flags.map((f) => f.id)).not.toContain(
      "first-gen-reading",
    );
    expect(result.statuses[2].flags.map((f) => f.id)).toContain(
      "first-gen-reading",
    );
  });
});

describe("a line that has not reached Canada yet", () => {
  // The state an interview that walks backwards from the applicant passes
  // through on every screen but the last. It must not read as a refusal.
  const noAnchor: Person[] = [
    { id: "mother", label: "My mother", birthDate: "1955-01-01", birthRegion: "outside" },
    { id: "me", label: "Me", birthDate: "1980-01-01", birthRegion: "outside" },
  ];

  it("reports incomplete, not fails", () => {
    const { headline } = classifyChain(noAnchor);
    expect(headline.verdict).toBe("incomplete");
    expect(headline.confidence).toBe("unknown");
    expect(headline.summary).toMatch(/no ancestor to reason from yet/);
    expect(headline.summary).toMatch(/Add the earliest ancestor you know of/);
  });

  it("becomes a real answer as soon as an anchor is added", () => {
    const withAnchor: Person[] = [
      {
        id: "grandmother",
        label: "My grandmother",
        birthDate: "1930-01-01",
        birthRegion: "canada",
        // Born in Canada before 1947, so the engine still needs to know she
        // kept British subject status — otherwise she is undetermined, not a (d).
        facts: { ceasedBritishSubject: false },
      },
      ...noAnchor,
    ];
    const result = classifyChain(withAnchor);
    expect(result.headline.verdict).toBe("qualifies");
    expect(result.statuses.map((s) => s.paragraph)).toEqual(["d", "g", "b"]);
  });

  it("does not claim incompleteness where an anchor exists and simply failed", () => {
    // Born in Canada before 1947, kept British subject status, died before the
    // 1946 Act reached them. There is an anchor; it just leads nowhere.
    const deadEnd: Person[] = [
      {
        id: "g0",
        birthDate: "1880-01-01",
        birthRegion: "canada",
        deathDate: "1930-01-01",
        facts: { ceasedBritishSubject: false },
      },
      { id: "g1", birthDate: "1910-01-01", birthRegion: "outside" },
    ];
    expect(classifyChain(deadEnd).headline.verdict).toBe("fails");
  });

  it("does not claim incompleteness for a chain that is merely undetermined", () => {
    expect(classifyChain(unaskedAnchorChain).headline.verdict).toBe("undetermined");
  });
});

describe("which assumptions actually carry the answer", () => {
  it("marks a default that changes the answer as decisive", () => {
    const result = classifyChain(gcmsChain);
    // Flipping the anchor's declaration of alienage takes the whole line down.
    const alienage = result.assumptions.find(
      (a) => a.personId === "g0" && a.factId === "declarationOfAlienage",
    );
    expect(alienage?.decisive).toBe(true);
  });

  it("marks a default that carried nothing as not decisive", () => {
    const result = classifyChain(gcmsChain);
    // G0 was born in Canada, so whether they also naturalised there is moot.
    const naturalised = result.assumptions.find(
      (a) => a.personId === "g0" && a.factId === "naturalizedInCanada",
    );
    expect(naturalised?.decisive).toBe(false);
  });

  it("leaves most of the forty alone, so the few that matter can be seen", () => {
    const { assumptions } = classifyChain(gcmsChain);
    const decisive = assumptions.filter((a) => a.decisive === true);
    expect(assumptions.length).toBeGreaterThan(20);
    expect(decisive.length).toBeGreaterThan(0);
    expect(decisive.length).toBeLessThan(assumptions.length / 2);
  });

  it("does not assess the aliveness assumption, and says so rather than guessing", () => {
    const alive = classifyChain(gcmsChain).assumptions.find(
      (a) => a.factId === null,
    );
    expect(alive).toBeDefined();
    expect(alive?.decisive).toBeUndefined();
  });

  it("can be switched off, and then reports nothing either way", () => {
    const result = classifyChain(gcmsChain, { assessAssumptions: false });
    expect(result.assumptions.every((a) => a.decisive === undefined)).toBe(true);
  });

  it("agrees with reality: flipping a decisive default really does move the answer", () => {
    // Guards against the counterfactual pass drifting away from the engine.
    const result = classifyChain(gcmsChain);
    for (const a of result.assumptions.filter((x) => x.decisive === true)) {
      if (a.factId === null) continue;
      const flipped = withFacts(gcmsChain, a.personId, { [a.factId]: true });
      const alt = classifyChain(flipped, { assessAssumptions: false });
      expect(
        alt.applicant.paragraph !== result.applicant.paragraph ||
          alt.applicant.outcome !== result.applicant.outcome,
        `${a.personId}:${a.factId} was marked decisive but changed nothing`,
      ).toBe(true);
    }
  });
});

describe("chain-level aggregation", () => {
  it("collects assumptions and gaps across every generation, deduplicated", () => {
    const result = classifyChain(unaskedAnchorChain);
    const keys = result.missing.map((m) => `${m.personId}:${m.factId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("g0:ceasedBritishSubject");
  });

  it("rejects an empty chain rather than inventing an applicant", () => {
    expect(() => classifyChain([])).toThrow(/at least one person/);
  });
});
