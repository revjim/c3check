/**
 * The rule table, as data.
 *
 * **First-match-wins is wrong.** A person can satisfy several paragraphs at
 * once — (m) is a British subject born abroad who was ordinarily resident in
 * Canada on 1 January 1947; (o) is someone born abroad before 1947 to a (k) or
 * (m) parent; one person can be both. That is precisely why subsection 3(6.3)
 * exists. So every rule is evaluated against every person and all matches are
 * collected; `precedence.ts` then decides which one survives.
 *
 * Each rule returns one of three verdicts. `unknown` is not a soft `no`: it
 * means a fact with no safe default has not been supplied, and the person
 * cannot be classified until it is.
 */

import {
  ACT_1947,
  ACT_1977,
  NFLD_UNION,
  isBefore,
  isOnOrAfter,
  isOnOrBefore,
} from "./dates";
import type { IsoDate } from "./dates";
import type {
  BirthplaceClass,
  FactId,
  Paragraph,
  Person,
  Status,
  UncertaintyFlagId,
} from "./types";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Whether a person held citizenship under the Canadian Citizenship Act, S.C.
 * 1946, c. 15 (or its 1952 consolidation) by operation of law.
 *
 * This is not a paragraph of s. 3(1) and it is not something the current Act
 * assigns. It is nonetheless load-bearing twice over: it is the literal parent
 * test in paragraph (q) — "a parent who became a citizen on that day under the
 * Canadian Citizenship Act, S.C. 1946, c. 15" — and it is what makes someone a
 * (d) rather than a (g).
 */
export type FormerActCitizenship =
  | { state: "citizen"; from: IsoDate; basis: string }
  | { state: "not-citizen"; why: string }
  | { state: "unknown"; missing: FactId[]; why: string };

export type RuleContext = {
  person: Person;
  label: string;
  birthDate: IsoDate;
  /** Resolved against the birth date — Newfoundland before the union is its own class. */
  place: BirthplaceClass;
  /** 1947-01-01, or 1949-04-01 for a pre-union Newfoundland birth. */
  pivot: IsoDate;
  /** 0 for a birth in Canada or Newfoundland, 1 for the first generation abroad. */
  generationAbroad: number;
  /** The previous person in the line, already classified. Null for the anchor. */
  parent: Status | null;
  /**
   * The parent exists but could not be classified — undetermined, or below a
   * detect-and-stop. Every parent test then answers `unknown` rather than `no`,
   * so an unresolved ancestor propagates as uncertainty instead of a denial.
   */
  parentUnresolved: boolean;
  /** A boolean fact: the stated answer, else the catalogue default, else undefined. */
  bool: (id: FactId) => boolean | undefined;
  /** A numeric fact: the stated answer, else the catalogue default, else undefined. */
  num: (id: FactId) => number | undefined;
  /** Alive on the given date. True when no death date was supplied. */
  aliveOn: (date: IsoDate) => boolean;
  formerAct: FormerActCitizenship;
};

export type FlagSeed = {
  id: UncertaintyFlagId;
  title: string;
  detail: string;
  sourceId: string;
};

export type RuleVerdict =
  | {
      kind: "match";
      because: string;
      /** A deceased-parent bridge or other provision relied on, e.g. `3(1.2)`. */
      via?: string;
      /** Set only where 3(7) has no rule for the paragraph — (a) and (d). */
      effectiveOverride?: IsoDate;
      flags?: FlagSeed[];
    }
  | { kind: "no"; because: string }
  | { kind: "unknown"; missing: FactId[]; because: string };

export type Rule = {
  paragraph: Paragraph;
  provision: string;
  /** How the paragraph reads, compressed to one line. */
  title: string;
  /** An `id` from `src/lib/sources.ts`. Every trace line has to cite something real. */
  sourceId: string;
  test: (ctx: RuleContext) => RuleVerdict;
};

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

const no = (because: string): RuleVerdict => ({ kind: "no", because });
const unknown = (missing: FactId[], because: string): RuleVerdict => ({
  kind: "unknown",
  missing,
  because,
});

/** The parent test cannot be run because the parent themselves has no answer. */
const parentUnresolved = (): RuleVerdict =>
  unknown(
    [],
    "the previous generation's own status is not resolved, so the parent test cannot be applied",
  );

/** Was the parent a citizen at the given moment, on their deemed effective date? */
function parentCitizenAt(parent: Status | null, when: IsoDate): boolean {
  return (
    parent !== null &&
    parent.outcome === "qualifies" &&
    parent.effectiveDate !== null &&
    isOnOrBefore(parent.effectiveDate, when)
  );
}

/** Is the parent a citizen under one of these paragraphs? */
function parentUnder(parent: Status | null, paragraphs: Paragraph[]): boolean {
  return (
    parent !== null &&
    parent.outcome === "qualifies" &&
    parent.paragraph !== null &&
    paragraphs.includes(parent.paragraph)
  );
}

/**
 * The parent was already dead when the deeming date arrived, so the child's
 * claim runs through one of the "citizen despite death of parent" bridges.
 */
function parentPredeceasedEffect(parent: Status | null): boolean {
  return (
    parent?.deathDate != null &&
    parent.effectiveDate != null &&
    isBefore(parent.deathDate, parent.effectiveDate)
  );
}

const JUDGMENT_CALL = (label: string, term: string): FlagSeed => ({
  id: "judgment-call",
  title: `"${term}" is a judgment call`,
  detail: `Whether ${label} was ${term} on that date is a fact-based assessment. IRCC's own guidance says the interpretation "is meant to provide officers with flexibility when assessing these cases", so a borderline case can go either way.`,
  sourceId: "ircc-pdi",
});

/**
 * Paragraph (q) contains no first-generation wording. IRCC asserts one twice —
 * in the PDI heading ("Born before January 1, 1947, in the first generation
 * outside Canada…") and again in the C-3 training deck at ATIP p. 155 ("When
 * paragraphs 3(1)(q) and (r) were written you could only be a (q) or an (r) if
 * you were born in the first generation outside of Canada"). The statute says
 * no such thing; its only limiter is the parent test.
 */
const FIRST_GEN_READING = (paragraph: "q" | "r"): FlagSeed => ({
  id: "first-gen-reading",
  title: `IRCC reads a first-generation limit into 3(1)(${paragraph})`,
  detail: `The text of paragraph 3(1)(${paragraph}) contains no first-generation wording — its only limiter is the parent test. IRCC's published guidance and its internal training material both describe the paragraph as applying in the first generation outside Canada. This tool follows the statute; be ready for an officer who follows the guidance.`,
  sourceId: "ircc-pdi",
});

/**
 * The first excluded cohort, ATIP p. 155: "people born before January 1, 1947
 * whose parent is a (q) and those born before April 1, 1949 whose parent is an
 * (r)… Until further operational instructions are given, these cases are to be
 * set aside." The internal guidance that would resolve it — ATIP p. 134,
 * "Recognition of a person as a Canadian citizen under paragraph 3(1)(q) where
 * their Canadian parent is also a citizen under paragraph 3(1)(q) (Internal
 * only)" — is withheld under section 23. The answer is genuinely unknown.
 */
const CONSECUTIVE = (paragraph: "q" | "r"): FlagSeed => ({
  id: "consecutive-q",
  title: `A (${paragraph}) whose parent is also a (${paragraph}) — IRCC has paused these`,
  detail: `IRCC's C-3 training material identifies this as a cohort that "may not automatically become citizens by operation of law" and directs that the cases "are to be set aside" until further operational instructions. The guidance that would resolve it is withheld under section 23 of the Access to Information Act. The classification below follows the statute; IRCC has not said it will.`,
  sourceId: "atip-1a-2025-14201",
});

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/**
 * Ordered for readability, not for precedence. Order carries no meaning here —
 * every rule runs, and `precedence.ts` resolves the result.
 */
export const RULES: Rule[] = [
  {
    paragraph: "a",
    provision: "3(1)(a)",
    title: "born in Canada after 14 February 1977",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (ctx.place !== "canada") {
        return no("not born in Canada");
      }
      if (isBefore(ctx.birthDate, ACT_1977)) {
        return no("born before 15 February 1977");
      }
      const diplomat = ctx.bool("foreignDiplomatParent");
      if (diplomat === undefined) {
        return unknown(
          ["foreignDiplomatParent"],
          "whether a parent held diplomatic status in Canada at the birth is not known",
        );
      }
      if (diplomat) {
        return no(
          "subsection 3(2) excludes a child born in Canada to a foreign diplomat where neither parent was a citizen or permanent resident",
        );
      }
      return {
        kind: "match",
        because: `born in Canada on ${ctx.birthDate}, after 14 February 1977`,
        effectiveOverride: ctx.birthDate,
      };
    },
  },

  {
    paragraph: "b",
    provision: "3(1)(b)",
    title:
      "born outside Canada after 14 February 1977 to a parent who was a citizen at the time",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (ctx.place !== "abroad") return no("not born outside Canada");
      if (isBefore(ctx.birthDate, ACT_1977)) {
        return no("born before 15 February 1977");
      }
      if (ctx.parentUnresolved) return parentUnresolved();
      if (!parentCitizenAt(ctx.parent, ctx.birthDate)) {
        return no("no parent in this line was a citizen at the time of the birth");
      }
      const via = usesDeathBridge(ctx);
      return {
        kind: "match",
        because: `born outside Canada on ${ctx.birthDate} to a parent who was a citizen at the time of the birth${
          via ? `, whose claim carries past their death by ${via}` : ""
        }`,
        via,
      };
    },
  },

  {
    paragraph: "d",
    provision: "3(1)(d)",
    title: "was a citizen immediately before 15 February 1977",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (ctx.formerAct.state === "unknown") {
        return unknown(ctx.formerAct.missing, ctx.formerAct.why);
      }
      if (ctx.formerAct.state === "not-citizen") {
        return no(ctx.formerAct.why);
      }
      if (isOnOrAfter(ctx.formerAct.from, ACT_1977)) {
        return no("did not become a citizen until 15 February 1977 or later");
      }
      // "Immediately before February 15, 1977" — so alive on the 14th.
      if (!ctx.aliveOn("1977-02-14")) {
        return no(
          "died before 15 February 1977, so was not a citizen immediately before that date",
        );
      }
      return {
        kind: "match",
        because: `${ctx.formerAct.basis}, and was still a citizen immediately before 15 February 1977`,
        effectiveOverride: ctx.formerAct.from,
      };
    },
  },

  {
    paragraph: "g",
    provision: "3(1)(g)",
    title:
      "born outside Canada before 15 February 1977 to a parent who was a citizen at the time, and did not become a citizen before 17 April 2009",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (ctx.place !== "abroad") return no("not born outside Canada");
      if (isOnOrAfter(ctx.birthDate, ACT_1977)) {
        return no("born on or after 15 February 1977");
      }
      if (ctx.parentUnresolved) return parentUnresolved();
      if (!parentCitizenAt(ctx.parent, ctx.birthDate)) {
        // The commonest near-miss in the whole Act. A parent deemed a citizen as
        // of 1947-01-01 was not a citizen at a birth in 1942, however retroactive
        // the deeming: such a child is a (q), not a (g).
        return no(
          "no parent in this line was a citizen at the time of the birth — a parent deemed a citizen as of 1 January 1947 was not yet a citizen at an earlier birth",
        );
      }
      if (ctx.formerAct.state === "unknown") {
        return unknown(ctx.formerAct.missing, ctx.formerAct.why);
      }
      if (ctx.formerAct.state === "citizen") {
        return no(
          "already became a citizen before 17 April 2009, which paragraph (g) excludes",
        );
      }
      // A grant does not defeat (g) here. Subsection 3(6.5) deems a person who
      // is described in (b), (f) to (j), (q) or (r) as a result of Bill C-3, and
      // who was granted citizenship before it came into force, never to have
      // been a citizen by way of grant — except for the purposes of the bar
      // provisions. So the paragraph matches and `bars.ts` does the work. An
      // unrenounced grant never reaches this point: it is a detect-and-stop.
      const via = usesDeathBridge(ctx);
      return {
        kind: "match",
        because: `born outside Canada on ${ctx.birthDate}, before 15 February 1977, to a parent who was a citizen at the time of the birth, and did not become a citizen before 17 April 2009${
          via ? `; the parent's death is bridged by ${via}` : ""
        }`,
        via,
      };
    },
  },

  {
    paragraph: "k",
    provision: "3(1)(k)",
    title:
      "born or naturalised in Canada before 1947, ceased to be a British subject, and did not become a citizen on 1 January 1947",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (isOnOrAfter(ctx.birthDate, ACT_1947)) {
        return no("born on or after 1 January 1947");
      }
      // Read the naturalisation fact only where it could matter — otherwise every
      // Canadian-born anchor collects an assumption that changed nothing.
      if (ctx.place !== "canada" && ctx.bool("naturalizedInCanada") !== true) {
        return no("neither born nor naturalised in Canada before 1947");
      }
      const ceased = ctx.bool("ceasedBritishSubject");
      if (ceased === undefined) {
        return unknown(
          ["ceasedBritishSubject"],
          "whether they ceased to be a British subject before 1947 is not known, and paragraph (k) turns entirely on it",
        );
      }
      if (!ceased) {
        return no(
          "did not cease to be a British subject before 1947 — dying before 1947 is not ceasing, and someone who kept the status simply became a citizen on 1 January 1947",
        );
      }
      return {
        kind: "match",
        because: `${
          ctx.place === "canada" ? "born" : "naturalised"
        } in Canada before 1 January 1947, ceased to be a British subject, and so did not become a citizen when the Canadian Citizenship Act came into force`,
      };
    },
  },

  {
    paragraph: "l",
    provision: "3(1)(l)",
    title:
      "born or naturalised in Newfoundland before 1 April 1949, ceased to be a British subject, and did not become a citizen on or before that day",
    sourceId: "citizenship-act",
    test: (ctx) => {
      if (isOnOrAfter(ctx.birthDate, NFLD_UNION)) {
        return no("born on or after 1 April 1949");
      }
      if (ctx.place !== "newfoundland" && ctx.bool("naturalizedInCanada") !== true) {
        return no(
          "neither born nor naturalised in Newfoundland and Labrador before the union",
        );
      }
      const ceased = ctx.bool("ceasedBritishSubject");
      if (ceased === undefined) {
        return unknown(
          ["ceasedBritishSubject"],
          "whether they ceased to be a British subject before 1 April 1949 is not known, and paragraph (l) turns entirely on it",
        );
      }
      if (!ceased) {
        return no("did not cease to be a British subject before 1 April 1949");
      }
      return {
        kind: "match",
        because: `${
          ctx.place === "newfoundland" ? "born" : "naturalised"
        } in Newfoundland and Labrador before 1 April 1949, ceased to be a British subject, and so did not become a citizen when the Newfoundland provisions were added to the Canadian Citizenship Act`,
      };
    },
  },

  {
    paragraph: "m",
    provision: "3(1)(m)",
    title:
      "a British subject, neither born nor naturalised in Canada, ordinarily resident in Canada on 1 January 1947, who did not become a citizen that day",
    sourceId: "citizenship-act",
    test: (ctx) => ordinarilyResidentRule(ctx, "m"),
  },

  {
    paragraph: "n",
    provision: "3(1)(n)",
    title:
      "a British subject, neither born nor naturalised in Newfoundland, ordinarily resident there on 1 April 1949, who did not become a citizen on or before that day",
    sourceId: "citizenship-act",
    test: (ctx) => ordinarilyResidentRule(ctx, "n"),
  },

  {
    paragraph: "o",
    provision: "3(1)(o)",
    title:
      "born outside Canada and Newfoundland before 1947 to a parent who is a citizen under (k) or (m)",
    sourceId: "citizenship-act",
    test: (ctx) => derivedPreUnionRule(ctx, "o"),
  },

  {
    paragraph: "p",
    provision: "3(1)(p)",
    title:
      "born outside Canada and Newfoundland before 1 April 1949 to a parent who is a citizen under (l) or (n)",
    sourceId: "citizenship-act",
    test: (ctx) => derivedPreUnionRule(ctx, "p"),
  },

  {
    paragraph: "q",
    provision: "3(1)(q)",
    title:
      "born outside Canada and Newfoundland before 1947 to a parent who became a citizen on 1 January 1947 under the Canadian Citizenship Act, S.C. 1946, c. 15",
    sourceId: "citizenship-act",
    test: (ctx) => derivedPreUnionRule(ctx, "q"),
  },

  {
    paragraph: "r",
    provision: "3(1)(r)",
    title:
      "born outside Canada and Newfoundland before 1 April 1949 to a parent who became a citizen on that day under s. 44A of the Canadian Citizenship Act",
    sourceId: "citizenship-act",
    test: (ctx) => derivedPreUnionRule(ctx, "r"),
  },
];

// ---------------------------------------------------------------------------
// Rule bodies shared between the Canada and Newfoundland tracks
// ---------------------------------------------------------------------------

/** Paragraphs (m) and (n) — identical but for the place and the pivot date. */
function ordinarilyResidentRule(ctx: RuleContext, paragraph: "m" | "n"): RuleVerdict {
  const nfld = paragraph === "n";
  const pivot = nfld ? NFLD_UNION : ACT_1947;
  const where = nfld ? "Newfoundland and Labrador" : "Canada";
  const homePlace: BirthplaceClass = nfld ? "newfoundland" : "canada";

  if (isOnOrAfter(ctx.birthDate, pivot)) {
    return no(`born on or after ${pivot}`);
  }
  if (!ctx.aliveOn(pivot)) {
    return no(
      `died before ${pivot}, and this paragraph describes a person's status *on* that date`,
    );
  }
  if (ctx.place === homePlace) {
    return no(`born in ${where}, which this paragraph excludes`);
  }
  // "and did not become a citizen on that day". Someone born in Canada in 1900
  // who moved to Newfoundland is "neither born nor naturalized" there, but was
  // already a citizen from 1 January 1947, so (n) cannot reach them.
  if (ctx.formerAct.state === "unknown") {
    return unknown(ctx.formerAct.missing, ctx.formerAct.why);
  }
  if (
    ctx.formerAct.state === "citizen" &&
    isOnOrBefore(ctx.formerAct.from, pivot)
  ) {
    return no(`became a citizen on or before ${pivot} in any event`);
  }
  const naturalised = ctx.bool("naturalizedInCanada");
  if (naturalised === undefined) {
    return unknown(
      ["naturalizedInCanada"],
      `whether they naturalised in ${where} is not known`,
    );
  }
  if (naturalised) {
    return no(`naturalised in ${where}, which this paragraph excludes`);
  }
  const britishSubject = ctx.bool("britishSubjectOnPivot");
  if (britishSubject === undefined) {
    return unknown(
      ["britishSubjectOnPivot"],
      `whether they were a British subject on ${pivot} is not known`,
    );
  }
  if (!britishSubject) return no(`was not a British subject on ${pivot}`);

  const resident = ctx.bool("ordinarilyResidentOnPivot");
  if (resident === undefined) {
    return unknown(
      ["ordinarilyResidentOnPivot"],
      `whether they were ordinarily resident in ${where} on ${pivot} is not known`,
    );
  }
  if (!resident) return no(`was not ordinarily resident in ${where} on ${pivot}`);

  if (ctx.bool("residentInNewfoundland") !== nfld) {
    return no(
      `the residence relied on was ${
        nfld ? "elsewhere in Canada, not in Newfoundland and Labrador" : "in Newfoundland and Labrador, which the parallel paragraph (n) covers"
      }`,
    );
  }

  const domicile = ctx.bool("canadianDomicileOnPivot");
  if (domicile === undefined) {
    return unknown(
      ["canadianDomicileOnPivot"],
      `whether they had ${nfld ? "Newfoundland" : "Canadian"} domicile on ${pivot} is not known`,
    );
  }
  if (domicile) {
    return no(
      `had ${nfld ? "Newfoundland" : "Canadian"} domicile on ${pivot}, and so did become a citizen that day — this paragraph catches only those who did not`,
    );
  }

  return {
    kind: "match",
    because: `on ${pivot} was a British subject, neither born nor naturalised in ${where}, ordinarily resident there, and without ${
      nfld ? "Newfoundland" : "Canadian"
    } domicile — so did not become a citizen that day`,
    flags: [JUDGMENT_CALL(ctx.label, "ordinarily resident")],
  };
}

/**
 * Paragraphs (o), (p), (q) and (r) — the four derived pre-union paragraphs.
 * All four require a birth outside both Canada and Newfoundland before the
 * pivot, a parent of a particular kind, and that the person did not themselves
 * become a citizen on the pivot date. They differ only in the parent test.
 */
function derivedPreUnionRule(
  ctx: RuleContext,
  paragraph: "o" | "p" | "q" | "r",
): RuleVerdict {
  const nfld = paragraph === "p" || paragraph === "r";
  const pivot = nfld ? NFLD_UNION : ACT_1947;
  const viaParentParagraph = paragraph === "o" || paragraph === "p";

  if (ctx.place !== "abroad") {
    return no("born in Canada or Newfoundland, not outside both");
  }
  if (isOnOrAfter(ctx.birthDate, pivot)) {
    return no(`born on or after ${pivot}`);
  }
  if (ctx.formerAct.state === "unknown") {
    return unknown(ctx.formerAct.missing, ctx.formerAct.why);
  }
  if (ctx.formerAct.state === "citizen" && isOnOrBefore(ctx.formerAct.from, pivot)) {
    return no(
      `became a citizen on or before ${pivot}, and this paragraph reaches only those who did not`,
    );
  }

  if (ctx.parentUnresolved) return parentUnresolved();

  if (viaParentParagraph) {
    const wanted: Paragraph[] = paragraph === "o" ? ["k", "m"] : ["l", "n"];
    if (!parentUnder(ctx.parent, wanted)) {
      return no(
        `parent is not a citizen under paragraph ${wanted
          .map((p) => `(${p})`)
          .join(" or ")}`,
      );
    }
    const bridge = parentPredeceasedEffect(ctx.parent) ? "3(1.2)" : undefined;
    return {
      kind: "match",
      because: `born outside Canada and Newfoundland on ${ctx.birthDate}, before ${pivot}, to a parent who is a citizen under paragraph (${ctx.parent?.paragraph}), and did not become a citizen on that day${
        bridge
          ? `; the parent died before the deeming date, so the claim runs through ${bridge}`
          : ""
      }`,
      via: bridge,
    };
  }

  // (q) and (r). The parent test is literal — "a parent who became a citizen on
  // that day under the Canadian Citizenship Act, S.C. 1946, c. 15" — but IRCC's
  // internal guidance (ATIP p. 135) extends it: a parent "recognized as citizens
  // as a result of amendments … under Bill C-24 and who were deemed to be
  // citizens as of January 1, 1947, under subsection 3(7)" is to be treated as
  // satisfying it. This engine follows that reading, and flags it.
  const parent = ctx.parent;
  const literal = nfld
    ? parent?.became1949ActCitizen === true
    : parent?.became1947ActCitizen === true;
  const deemed =
    parent != null &&
    parent.outcome === "qualifies" &&
    parent.effectiveDate === pivot &&
    parent.paragraph !== null &&
    (nfld ? ["l", "n", "p", "r"] : ["k", "m", "o", "q"]).includes(parent.paragraph);

  if (!literal && !deemed) {
    return no(
      `parent did not become a citizen on ${pivot}${
        nfld
          ? " under section 44A of the Canadian Citizenship Act"
          : " under the Canadian Citizenship Act, S.C. 1946, c. 15"
      }`,
    );
  }

  // The first-generation reading only bites beyond the first generation abroad.
  // For a first-generation (q) the statute and IRCC's gloss agree, so saying
  // they disagree would be noise.
  const flags: FlagSeed[] = [];
  if (ctx.generationAbroad >= 2) flags.push(FIRST_GEN_READING(nfld ? "r" : "q"));
  if (parent?.paragraph === paragraph) {
    flags.push(CONSECUTIVE(nfld ? "r" : "q"));
  }

  const bridge = parentPredeceasedEffect(parent) ? (nfld ? "3(1.4)" : "3(1.3)") : undefined;
  return {
    kind: "match",
    because: literal
      ? `born outside Canada and Newfoundland on ${ctx.birthDate} to a parent who became a citizen on ${pivot} under the Canadian Citizenship Act, and did not become a citizen that day`
      : `born outside Canada and Newfoundland on ${ctx.birthDate} to a parent who is deemed a citizen as of ${pivot} under paragraph (${parent?.paragraph}); IRCC treats such a parent as one who "would have become a citizen" on that day under the 1946 Act`,
    via: bridge,
    flags,
  };
}

/**
 * Subsection 3(1.5): where the parent — or the parent and the grandparent — died
 * before Bill C-3 came into force, and would have been a citizen as a result of
 * it. Returns the provision to cite, or undefined where no bridge is needed.
 */
function usesDeathBridge(ctx: RuleContext): string | undefined {
  const parent = ctx.parent;
  if (parent?.deathDate == null) return undefined;
  if (parent.remediedBy !== "c-3") return undefined;
  return "3(1.5)";
}

/** Every paragraph the rule table can assign. */
export const CLASSIFIED_BY_RULES: Paragraph[] = RULES.map((r) => r.paragraph);
