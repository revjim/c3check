/**
 * The fold: anchor to applicant, one generation at a time.
 *
 * Each person's status is a function of four things: their birth date, their
 * birthplace class resolved against that date, and the previous generation's
 * paragraph and effective date. That is what makes a line computable in a single
 * forward pass, and it is why the engine models a line and not a tree.
 *
 * Three conditions halt a chain rather than guess at it: adoption anywhere in
 * the line, any loss-and-restoration event, and a person who holds citizenship
 * by grant. Each returns a distinct reason and a pointer to the provision.
 */

import {
  ACT_1947,
  ACT_1977,
  NFLD_UNION,
  isBefore,
  isOnOrAfter,
  pivotFor,
  resolvePlace,
} from "./dates";
import type { IsoDate } from "./dates";
import { applyBars } from "./bars";
import { buildAdvisories, deathCohortFlag, reachFlags } from "./advisory";
import { deemingProvisionFor, effectiveDateFor } from "./deeming";
import { DOCUMENTS } from "./documents";
import { FACTS, documentsFor, questionFor } from "./facts";
import { applyFirstGenerationLimit } from "./fgl";
import { orgIdFor } from "./orgIds";
import { outranks, resolvePrecedence } from "./precedence";
import { RULES } from "./rules";
import type { FormerActCitizenship, RuleContext } from "./rules";
import type {
  Amendment,
  Assumption,
  ChainResult,
  FactId,
  Headline,
  MissingFact,
  Paragraph,
  Person,
  RuleTrace,
  Status,
  StopReason,
  UncertaintyFlag,
} from "./types";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type ClassifyOptions = {
  /**
   * Re-run the chain with each applied default inverted, to find which
   * assumptions actually carry the answer. On by default: a result that lists
   * forty assumptions without saying which three matter has told the reader
   * everything and nothing.
   *
   * Set false inside a re-run, which is the only place it should be false.
   */
  assessAssumptions?: boolean;
};

/**
 * Classifies one line of descent.
 *
 * `people` runs anchor first, applicant last; each person's parent is the entry
 * before them. Pure: no I/O, no system clock, no mutation of the input.
 */
export function classifyChain(
  people: Person[],
  options: ClassifyOptions = {},
): ChainResult {
  const result = runChain(people);
  if (options.assessAssumptions === false) return result;
  markDecisiveAssumptions(people, result);
  return result;
}

function runChain(people: Person[]): ChainResult {
  if (people.length === 0) {
    throw new Error("A chain needs at least one person.");
  }

  const statuses: Status[] = [];
  for (let i = 0; i < people.length; i++) {
    statuses.push(classifyPerson(people[i], statuses[i - 1] ?? null, i));
  }

  // Two flags need the whole chain rather than one person.
  for (const status of statuses) {
    const cohort = deathCohortFlag(status);
    if (cohort !== null) status.flags.push(cohort);
  }
  for (const flag of reachFlags(statuses)) {
    const target = statuses.find((s) => s.personId === flag.personId);
    target?.flags.push(flag);
  }

  const advisories = buildAdvisories(statuses, people);
  const applicant = statuses[statuses.length - 1];

  return {
    statuses,
    applicant,
    headline: headlineFor(
      applicant,
      advisories.length > 0,
      lacksAnchor(people, statuses),
    ),
    advisories,
    // Keyed on the statement rather than the fact where there is no fact. The
    // aliveness assumption is made per date, and collapsing two dates into one
    // would hide half of what was assumed.
    assumptions: dedupe(
      statuses.flatMap((s) => s.assumptions),
      (a) => `${a.personId}:${a.factId ?? a.statement}`,
    ),
    missing: dedupe(statuses.flatMap((s) => s.missing), (m) => `${m.personId}:${m.factId}`),
    flags: statuses.flatMap((s) => s.flags),
  };
}

// ---------------------------------------------------------------------------
// One person
// ---------------------------------------------------------------------------

function classifyPerson(
  person: Person,
  parent: Status | null,
  index: number,
): Status {
  const label = person.label ?? `Generation ${index}`;
  const place = resolvePlace(person.birthRegion, person.birthDate);
  const pivot = pivotFor(place);
  const generationAbroad =
    place === "abroad" ? (parent?.generationAbroad ?? 0) + 1 : 0;

  const assumptions: Assumption[] = [];
  const assumed = new Set<string>();
  const trace: RuleTrace[] = [];
  const flags: UncertaintyFlag[] = [];
  const missingIds = new Set<FactId>();

  const recordAssumption = (factId: FactId | null, statement: string): void => {
    const key = factId ?? statement;
    if (assumed.has(key)) return;
    assumed.add(key);
    assumptions.push({
      personId: person.id,
      factId,
      statement: `${label}: ${statement}`,
      why: factId === null ? WHY_ALIVE : FACTS[factId].why,
      documents: factId === null ? DOCUMENTS["date-of-death"] : documentsFor(factId),
    });
  };

  const read = (id: FactId): boolean | number | undefined => {
    const stated = person.facts?.[id];
    if (stated !== undefined) return stated;
    const fallback = FACTS[id].defaultWhenUnasked;
    if (fallback === undefined) return undefined;
    recordAssumption(id, FACTS[id].defaultStatement ?? `assumed ${String(fallback)}`);
    return fallback;
  };

  const bool = (id: FactId): boolean | undefined => {
    const value = read(id);
    return typeof value === "boolean" ? value : undefined;
  };
  const num = (id: FactId): number | undefined => {
    const value = read(id);
    return typeof value === "number" ? value : undefined;
  };
  const aliveOn = (date: IsoDate): boolean => {
    if (person.deathDate === undefined) {
      recordAssumption(
        null,
        `no date of death was given, so they are assumed to have been alive on ${date}`,
      );
      return true;
    }
    return isOnOrAfter(person.deathDate, date);
  };

  const base = {
    personId: person.id,
    label,
    birthDate: person.birthDate,
    deathDate: person.deathDate ?? null,
    generationAbroad,
    trace,
    flags,
    assumptions,
    alternatives: [] as Paragraph[],
  };

  // --- Detect and stop -----------------------------------------------------

  const stop = detectStop(person, parent, label, bool);
  if (stop !== null) {
    trace.push({
      provision: stop.provision,
      sourceId: stop.sourceId,
      kind: "note",
      because: stop.detail,
    });
    return {
      ...base,
      outcome: "stopped",
      paragraph: null,
      effectiveDate: null,
      deemingProvision: null,
      remediedBy: null,
      became1947ActCitizen: false,
      became1949ActCitizen: false,
      stopReason: stop,
      missing: [],
      orgId: null,
    };
  }

  // --- Derived: citizenship under the 1946 and 1952 Acts -------------------

  const formerAct = formerActCitizenship(person, place, pivot, bool, aliveOn);
  const became1947ActCitizen =
    formerAct.state === "citizen" && formerAct.from === ACT_1947;
  const became1949ActCitizen =
    formerAct.state === "citizen" && formerAct.from === NFLD_UNION;

  const ctx: RuleContext = {
    person,
    label,
    birthDate: person.birthDate,
    place,
    pivot,
    generationAbroad,
    parent,
    parentUnresolved:
      parent !== null &&
      (parent.outcome === "undetermined" || parent.outcome === "stopped"),
    bool,
    num,
    aliveOn,
    formerAct,
  };

  // --- Run every rule ------------------------------------------------------

  const matched: Paragraph[] = [];
  const unresolved: { paragraph: Paragraph; missing: FactId[] }[] = [];
  const rulePayload = new Map<
    Paragraph,
    { via?: string; effectiveOverride?: IsoDate }
  >();

  for (const rule of RULES) {
    const verdict = rule.test(ctx);
    switch (verdict.kind) {
      case "match":
        matched.push(rule.paragraph);
        rulePayload.set(rule.paragraph, {
          via: verdict.via,
          effectiveOverride: verdict.effectiveOverride,
        });
        trace.push({
          provision: rule.provision,
          sourceId: rule.sourceId,
          kind: "matched",
          because: verdict.because,
        });
        for (const seed of verdict.flags ?? []) {
          flags.push({ ...seed, personId: person.id });
        }
        break;
      case "unknown":
        unresolved.push({ paragraph: rule.paragraph, missing: verdict.missing });
        trace.push({
          provision: rule.provision,
          sourceId: rule.sourceId,
          kind: "unknown",
          because: verdict.because,
        });
        break;
      case "no":
        // Recorded but not surfaced by default: a full list of every paragraph
        // that did not apply is noise on a results page and gold in a bug report.
        trace.push({
          provision: rule.provision,
          sourceId: rule.sourceId,
          kind: "not-matched",
          because: verdict.because,
        });
        break;
    }
  }

  // --- Bars ----------------------------------------------------------------

  // Bars are applied to everything that is still in play, not only to what
  // matched. A paragraph left open for want of a fact is worth nothing if a bar
  // would have shut it off anyway, and if that were not accounted for, barring
  // the winner would resurrect it and make the person undetermined.
  const bars = applyBars(ctx, [
    ...matched,
    ...unresolved.map((u) => u.paragraph),
  ]);
  trace.push(...bars.traces);
  for (const id of bars.missing) missingIds.add(id);
  const live0 = matched.filter((p) => !bars.barred.includes(p));
  const stillOpen = unresolved.filter((u) => !bars.barred.includes(u.paragraph));
  let live = live0;

  // --- Precedence ----------------------------------------------------------

  let resolved = resolvePrecedence(live);
  trace.push(...resolved.traces);

  // --- The first-generation limit ------------------------------------------

  if (resolved.winner === "b") {
    const fgl = applyFirstGenerationLimit(ctx);
    trace.push(...fgl.traces);
    for (const id of fgl.missing) missingIds.add(id);
    if (fgl.blocked) {
      live = live.filter((p) => p !== "b");
      resolved = resolvePrecedence(live);
      trace.push(...resolved.traces);
    }
  }

  // --- Does anything still unresolved matter? ------------------------------
  //
  // A rule that could not be decided only makes the person undetermined if it
  // could still win. Paragraph (m) left open behind a settled (o) changes
  // nothing: 3(6.3) would supersede it either way.

  const winnerSoFar = resolved.winner;
  const material = stillOpen.filter(
    (u) => winnerSoFar === null || outranks(u.paragraph, winnerSoFar),
  );
  const immaterial = stillOpen.filter((u) => !material.includes(u));
  if (immaterial.length > 0 && winnerSoFar !== null) {
    trace.push({
      provision: "3(6.3)",
      sourceId: "citizenship-act",
      kind: "note",
      because: `paragraph ${immaterial
        .map((u) => `(${u.paragraph})`)
        .join(", ")} could not be decided on the facts given, but could not have changed the result, paragraph (${winnerSoFar}) takes precedence over ${
        immaterial.length === 1 ? "it" : "them"
      } in any event`,
    });
  }

  // Only the facts that could still change something are reported as gaps.
  // An open (m) behind a settled (o) is not a gap, it is a footnote.
  for (const u of material) for (const id of u.missing) missingIds.add(id);

  const missing: MissingFact[] = [...missingIds].map((id) => ({
    personId: person.id,
    factId: id,
    question: questionFor(id, label),
    why: FACTS[id].why,
    documents: documentsFor(id),
  }));

  // A parent-dependent rule left open by an unresolved ancestor names no fact of
  // its own (the gap is upstream), but it still makes this person undetermined.
  const undetermined = material.length > 0 || missing.length > 0;

  // --- Assemble ------------------------------------------------------------

  if (undetermined) {
    return {
      ...base,
      outcome: "undetermined",
      paragraph: null,
      effectiveDate: null,
      deemingProvision: null,
      remediedBy: null,
      became1947ActCitizen,
      became1949ActCitizen,
      stopReason: null,
      missing,
      orgId: null,
    };
  }

  if (resolved.winner === null) {
    // No paragraph. The person may still be a citizen, someone who simply
    // became one on 1 January 1947 under the 1946 Act and died before 1977 is,
    // and is a valid (q) parent, but no paragraph of s. 3(1) as it now reads
    // describes them.
    if (formerAct.state === "citizen") {
      trace.push({
        provision: "Canadian Citizenship Act, S.C. 1946, c. 15",
        sourceId: "citizenship-act",
        kind: "note",
        because: `${formerAct.basis}. No paragraph of section 3(1) as it now reads describes them, because none needs to; they were already a citizen. Paragraph 3(1)(q) refers to exactly this person as a parent.`,
      });
      return {
        ...base,
        outcome: "qualifies",
        paragraph: null,
        effectiveDate: formerAct.from,
        deemingProvision: null,
        remediedBy: "pre-existing",
        became1947ActCitizen,
        became1949ActCitizen,
        stopReason: null,
        missing: [],
        orgId: null,
      };
    }
    return {
      ...base,
      outcome: "fails",
      paragraph: null,
      effectiveDate: null,
      deemingProvision: null,
      remediedBy: null,
      became1947ActCitizen,
      became1949ActCitizen,
      stopReason: null,
      missing: [],
      orgId: null,
    };
  }

  const winner = resolved.winner;
  const payload = rulePayload.get(winner) ?? {};
  const effectiveDate =
    payload.effectiveOverride ?? effectiveDateFor(winner, person.birthDate);
  // Only cite 3(7) where 3(7) did the work. An ordinary (d) was simply already a
  // citizen, and 3(7)(b), which the deeming map records against (d), reaches
  // only a (d) who lost citizenship by grant and resumed it. Citing it here
  // would put a provision in the trace that does not apply to this person.
  const deemingProvision =
    payload.effectiveOverride === undefined ? deemingProvisionFor(winner) : null;
  const remediedBy = amendmentFor(winner, generationAbroad, parent);

  if (deemingProvision !== null && effectiveDate !== null) {
    trace.push({
      provision: deemingProvision,
      sourceId: "citizenship-act",
      kind: "note",
      because: `citizenship takes effect from ${effectiveDate}${
        effectiveDate === person.birthDate ? ", the moment of birth" : ""
      }`,
    });
  }
  if (payload.via !== undefined) {
    trace.push({
      provision: payload.via,
      sourceId: "citizenship-act",
      kind: "note",
      because: `the claim carries past a parent's death by subsection ${payload.via}`,
    });
  }

  return {
    ...base,
    alternatives: resolved.alternatives,
    outcome: "qualifies",
    paragraph: winner,
    effectiveDate,
    deemingProvision,
    remediedBy,
    // Deliberately not widened to "anyone deemed a citizen as of 1947-01-01".
    // Paragraph (q)'s parent test is literal, and the reading that extends it to
    // a deemed parent is IRCC guidance rather than statute, the (q) rule keeps
    // the two apart so the trace can say which one it used.
    became1947ActCitizen,
    became1949ActCitizen,
    stopReason: null,
    missing: [],
    orgId: orgIdFor(winner, generationAbroad, person.birthDate),
  };
}


// ---------------------------------------------------------------------------
// Detect and stop
// ---------------------------------------------------------------------------

function detectStop(
  person: Person,
  parent: Status | null,
  label: string,
  bool: (id: FactId) => boolean | undefined,
): StopReason | null {
  if (parent !== null && parent.outcome === "stopped") {
    return {
      id: "ancestor-stopped",
      personId: person.id,
      title: "An earlier generation could not be classified",
      detail: `${label}'s claim runs through ${parent.label}, whose own status this tool declines to work out. Nothing below that point can be classified either.`,
      provision: parent.stopReason?.provision ?? "3(1)",
      sourceId: parent.stopReason?.sourceId ?? "citizenship-act",
    };
  }

  if (bool("adopted") === true) {
    return {
      id: "adoption",
      personId: person.id,
      title: "Adoption in the line",
      detail: `${label} was adopted. Citizenship for an adopted person runs through a grant under section 5.1 and takes effect from the date of the grant, not retroactively, a different mechanism from the descent this tool follows, and one that needs a different application form. An adoptee part-way up a line also breaks the descent logic entirely, so the chain stops here.`,
      provision: "3(1)(c.1), s. 5.1",
      sourceId: "citizenship-act",
    };
  }

  if (bool("lostAndRestored") === true) {
    return {
      id: "loss-and-restoration",
      personId: person.id,
      title: "Citizenship was lost and later restored",
      detail: `${label} lost Canadian citizenship and later had it back, whether under the former section 8 retention rule, a resumption, or a later grant. That is paragraph (f), (h), (i) or (j) territory. Those paragraphs run on their own timeline, with effective dates keyed to when the person ceased to be a citizen rather than to their birth, and this tool stops rather than guess at them. The interview asks about it because subsections 3(2.1) to 3(2.5) turn on it.`,
      provision: "3(1)(f), (h), (i), (j)",
      sourceId: "citizenship-act",
    };
  }

  if (bool("citizenshipByGrant") === true && bool("renouncedCitizenship") !== true) {
    return {
      id: "citizen-by-grant",
      personId: person.id,
      title: "Already a citizen by grant",
      detail: `${label} holds Canadian citizenship by grant. A grant takes effect from the date it is made, going forward. This tool answers a different question, which paragraph already makes someone a citizen, retroactively, by operation of law, and has nothing to add for someone who is a citizen under paragraph 3(1)(c) or (c.1) already.`,
      provision: "3(1)(c), 3(1)(c.1)",
      sourceId: "citizenship-act",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Citizenship under the former Act
// ---------------------------------------------------------------------------

const WHY_ALIVE =
  "Several paragraphs describe a person's status *on* a particular date, 1 January 1947 or 1 April 1949, which someone who had already died cannot have had.";

function formerActCitizenship(
  person: Person,
  place: "canada" | "newfoundland" | "abroad",
  pivot: IsoDate,
  bool: (id: FactId) => boolean | undefined,
  aliveOn: (date: IsoDate) => boolean,
): FormerActCitizenship {
  const birth = person.birthDate;

  if (place === "canada") {
    if (isOnOrAfter(birth, ACT_1977)) {
      return {
        state: "not-citizen",
        why: "born on or after 15 February 1977, after the current Act replaced the former one",
      };
    }
    if (isOnOrAfter(birth, ACT_1947)) {
      return {
        state: "citizen",
        from: birth,
        basis: `born in Canada on ${birth}, and so a citizen from birth under the Canadian Citizenship Act then in force`,
      };
    }
    const ceased = bool("ceasedBritishSubject");
    if (ceased === undefined) {
      return {
        state: "unknown",
        missing: ["ceasedBritishSubject"],
        why: "whether they were still a British subject on 1 January 1947 is not known, and it decides whether they became a citizen that day or fall into paragraph (k)",
      };
    }
    if (ceased) {
      return {
        state: "not-citizen",
        why: "ceased to be a British subject before 1947, and so did not become a citizen when the Canadian Citizenship Act came into force",
      };
    }
    if (!aliveOn(ACT_1947)) {
      return {
        state: "not-citizen",
        why: "died before 1 January 1947. The 1946 Act made citizens of people who were British subjects immediately before that day; dying is not the same as ceasing to be one, so paragraph (k) does not reach them either",
      };
    }
    return {
      state: "citizen",
      from: ACT_1947,
      basis: `born in Canada, still a British subject on 1 January 1947, and so a citizen on that day under the Canadian Citizenship Act, S.C. 1946, c. 15`,
    };
  }

  if (place === "newfoundland") {
    const ceased = bool("ceasedBritishSubject");
    if (ceased === undefined) {
      return {
        state: "unknown",
        missing: ["ceasedBritishSubject"],
        why: "whether they were still a British subject on 1 April 1949 is not known, and it decides whether they became a citizen at the union or fall into paragraph (l)",
      };
    }
    if (ceased) {
      return {
        state: "not-citizen",
        why: "ceased to be a British subject before 1 April 1949, and so did not become a citizen at the union",
      };
    }
    if (!aliveOn(NFLD_UNION)) {
      return {
        state: "not-citizen",
        why: "died before 1 April 1949, so was not made a citizen when the Newfoundland provisions were added to the Canadian Citizenship Act",
      };
    }
    return {
      state: "citizen",
      from: NFLD_UNION,
      basis: `born in Newfoundland and Labrador, still a British subject on 1 April 1949, and so a citizen on that day under section 44A of the Canadian Citizenship Act`,
    };
  }

  // Born abroad.
  if (bool("birthAbroadRegistered") === true) {
    const from = isBefore(birth, ACT_1947) ? ACT_1947 : birth;
    return {
      state: "citizen",
      from,
      basis: `born outside Canada with the birth registered under the Canadian Citizenship Act then in force, and so a citizen from ${from}`,
    };
  }
  // Domicile on the pivot date can only matter for someone alive before it.
  if (
    isBefore(birth, pivot) &&
    bool("canadianDomicileOnPivot") === true &&
    aliveOn(pivot)
  ) {
    return {
      state: "citizen",
      from: pivot,
      basis: `a British subject with Canadian domicile on ${pivot}, and so a citizen on that day under the Canadian Citizenship Act`,
    };
  }
  return {
    state: "not-citizen",
    why: "born outside Canada, with no registration of the birth under the former Act and no Canadian domicile on the relevant date",
  };
}

// ---------------------------------------------------------------------------
// Which amendment did the work
// ---------------------------------------------------------------------------

/**
 * Feeds the advisory layer: IRCC's processing pause and its second excluded
 * cohort both turn on *which* amending Act put a given ancestor inside s. 3(1).
 *
 * The rule is: the amendment that introduced the paragraph, unless the paragraph
 * only becomes available to this person because C-3 removed the first-generation
 * limit (a (b) or (g) in the second generation abroad, or a (q)/(r) whose own
 * parent is a (q)/(r)), in which case it is C-3.
 */
function amendmentFor(
  paragraph: Paragraph,
  generationAbroad: number,
  parent: Status | null,
): Amendment {
  switch (paragraph) {
    case "a":
    case "d":
    case "e":
    case "c":
    case "c.1":
      return "pre-existing";
    case "b":
      return generationAbroad >= 2 ? "c-3" : "pre-existing";
    case "g":
    case "h":
      return generationAbroad >= 2 ? "c-3" : "c-37";
    case "f":
    case "i":
    case "j":
      return "c-37";
    case "q":
    case "r":
      // The first excluded cohort: a (q) whose parent is also a (q) exists only
      // because C-3 removed the limit, and is exactly what IRCC has paused.
      return parent?.paragraph === paragraph ? "c-3" : "c-24";
    default:
      return "c-24";
  }
}

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

/**
 * The line as entered has no anchor: nobody in it was born in Canada or in
 * Newfoundland before the union, and nobody naturalised there.
 *
 * Paragraphs (a), (d), (k) and (l), the ones that do not depend on a citizen
 * parent, all require birth or naturalisation in one of those places, and (m)
 * and (n) require having been there on the pivot date. So a chain of people all born
 * abroad has nothing to reason from, and reporting that as "not a citizen" is
 * wrong twice over: it answers a question nobody asked, and it does so in the
 * one direction that makes someone stop looking.
 *
 * The engine cannot know whether the user has more ancestors to add. It can know
 * that it has not been given an anchor, which is what this says.
 */
function lacksAnchor(people: Person[], statuses: Status[]): boolean {
  // An unresolved or halted chain is already saying something truer than this.
  if (!statuses.every((s) => s.outcome === "fails")) return false;
  return people.every(
    (person) =>
      resolvePlace(person.birthRegion, person.birthDate) === "abroad" &&
      person.facts?.naturalizedInCanada !== true,
  );
}

function headlineFor(
  applicant: Status,
  hasAdvisories: boolean,
  noAnchor: boolean,
): Headline {
  const flagged = applicant.flags.length > 0 || hasAdvisories;
  const base = {
    paragraph: applicant.paragraph,
    effectiveDate: applicant.effectiveDate,
  };

  if (noAnchor) {
    return {
      ...base,
      verdict: "incomplete",
      confidence: "unknown",
      summary:
        "No one in this line was born in Canada, or in Newfoundland and Labrador before it joined Confederation, so there is no ancestor to reason from yet. Add the earliest ancestor you know of and this will start to resolve. Every route to citizenship by descent begins with someone who was there.",
    };
  }

  switch (applicant.outcome) {
    case "qualifies":
      return {
        ...base,
        verdict: "qualifies",
        confidence: flagged ? "flagged" : "clear",
        summary: applicant.paragraph
          ? `On the facts given, ${applicant.label} is a citizen under paragraph 3(1)(${applicant.paragraph}), effective ${applicant.effectiveDate}.${
              flagged
                ? " Read the flags below before relying on it: parts of this rest on a reading IRCC has not confirmed."
                : ""
            }`
          : `On the facts given, ${applicant.label} was already a citizen under the Canadian Citizenship Act then in force, effective ${applicant.effectiveDate}.`,
      };
    case "fails":
      return {
        ...base,
        verdict: "fails",
        confidence: flagged ? "flagged" : "clear",
        summary: `On the facts given, no paragraph of section 3(1) describes ${applicant.label}. That is a conclusion about this line as entered, not about every possible route, a second parent, or a different anchor, may reach a different answer.`,
      };
    case "undetermined":
      return {
        ...base,
        verdict: "undetermined",
        confidence: "unknown",
        summary: `${applicant.label} cannot be classified yet. ${
          applicant.missing.length > 0
            ? `${applicant.missing.length} fact${applicant.missing.length === 1 ? "" : "s"} still to establish for this generation`
            : "An earlier generation is unresolved"
        }, and until then any answer here would be invented rather than derived.`,
      };
    case "stopped":
      return {
        ...base,
        verdict: "stopped",
        confidence: "unknown",
        summary:
          applicant.stopReason?.detail ??
          `This tool stops short of classifying ${applicant.label}.`,
      };
    case "incomplete":
      // Chain-level only, and handled by the early return above. No person is
      // ever given this outcome, so reaching here means that invariant broke.
      throw new Error(
        "'incomplete' is a chain-level verdict and must not be set on a person.",
      );
  }
}

// ---------------------------------------------------------------------------
// Which assumptions actually carry the answer
// ---------------------------------------------------------------------------

/**
 * Stamps `decisive` on every assumption by re-running the chain with that
 * default inverted and seeing whether the applicant's answer moves.
 *
 * A five-generation chain reads around forty defaults, so this is forty extra
 * runs. The engine is pure and a run is a fraction of a millisecond, so the cost
 * is nothing next to what it buys: the difference between "here are forty things
 * we assumed" and "three of these would change your answer if we have them
 * wrong, and here they are".
 *
 * Decisiveness is measured against the *applicant*, because that is the answer
 * being reported. A flip that changes a paragraph half way up the line without
 * moving the applicant's own is real but not what the reader is deciding on.
 */
function markDecisiveAssumptions(people: Person[], result: ChainResult): void {
  const baseline = result.applicant;

  for (const status of result.statuses) {
    for (const assumption of status.assumptions) {
      if (assumption.factId === null) continue; // aliveness; no single inverse
      const inverted = invertFact(people, assumption.personId, assumption.factId);
      if (inverted === null) continue;
      const alternative = runChain(inverted).applicant;
      assumption.decisive =
        alternative.outcome !== baseline.outcome ||
        alternative.paragraph !== baseline.paragraph ||
        alternative.effectiveDate !== baseline.effectiveDate;
    }
  }
}

/**
 * A copy of the chain with one boolean fact set to the opposite of the default
 * that was applied. Returns null for anything not a boolean, a numeric fact has
 * no inverse, and in any case only facts with defaults become assumptions.
 */
function invertFact(
  people: Person[],
  personId: string,
  factId: FactId,
): Person[] | null {
  const fallback = FACTS[factId].defaultWhenUnasked;
  if (typeof fallback !== "boolean") return null;

  return people.map((person) =>
    person.id === personId
      ? { ...person, facts: { ...person.facts, [factId]: !fallback } }
      : person,
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
