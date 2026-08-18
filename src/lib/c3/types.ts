/**
 * The vocabulary of the classifier.
 *
 * Nothing here executes. The shapes are shared by the rule table, the bars, the
 * advisory layer and the fold in `classify.ts`, and they are the contract the
 * interview and the results table will later be written against.
 */

import type { IsoDate } from "./dates";

// ---------------------------------------------------------------------------
// Paragraphs
// ---------------------------------------------------------------------------

/** Every paragraph of s. 3(1), whether or not v1 classifies under it. */
export type Paragraph =
  | "a"
  | "b"
  | "c"
  | "c.1"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r";

/**
 * The paragraphs v1 will assign.
 *
 * (c) and (c.1) are grants, a different mechanism with a different form, and
 * effective going forward rather than retroactively. (e) is a 1977 transitional
 * entitlement. (f), (h), (i) and (j) are loss-and-restoration; the interview has
 * to ask about those events anyway, because the 3(2.x) bars turn on them, but v1
 * detects and stops rather than classifying. See `STOP_REASONS`.
 */
export const CLASSIFIED_PARAGRAPHS = [
  "a",
  "b",
  "d",
  "g",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
] as const satisfies readonly Paragraph[];

export type ClassifiedParagraph = (typeof CLASSIFIED_PARAGRAPHS)[number];

/** Renders a paragraph as it is cited: `3(1)(c.1)`. */
export function provisionOf(paragraph: Paragraph): string {
  return `3(1)(${paragraph})`;
}

// ---------------------------------------------------------------------------
// Places and people
// ---------------------------------------------------------------------------

/**
 * Where a birth happened, as the user states it. Resolved to a
 * `BirthplaceClass` against the birth date, see `resolvePlace`.
 */
export type BirthRegion = "canada" | "newfoundland" | "outside";

/** Where a birth counts as having happened, once the date is applied. */
export type BirthplaceClass = "canada" | "newfoundland" | "abroad";

/**
 * The facts about one person that the statute can turn on and that a genealogy
 * file cannot supply. Every field is optional: an unanswered fact either takes
 * the default recorded in the fact catalogue (and is reported as an assumption)
 * or has no default, in which case the person is `undetermined`.
 */
export type PersonFacts = {
  /**
   * Ceased to be a British subject before the pivot date, by naturalising in
   * another country, or, for a woman before 1947, by marrying a man who was not
   * a British subject. Decides (k) and (l). No default: there is no common
   * answer, and the whole chain usually hangs on it.
   */
  ceasedBritishSubject?: boolean;
  /** Was a British subject on the pivot date. Needed by (m) and (n). */
  britishSubjectOnPivot?: boolean;
  /**
   * Ever lived in Canada or in Newfoundland before the union at all. Gates the
   * whole (m)/(n) branch: those paragraphs reach only people who were physically
   * in one of those places on the pivot date, and for most lines the family
   * emigrated and stayed away. Defaults to no, so the three facts below are
   * asked only of someone who might actually satisfy them.
   */
  livedInCanadaOrNewfoundland?: boolean;
  /** Was ordinarily resident in Canada / Newfoundland on the pivot date. (m), (n). */
  ordinarilyResidentOnPivot?: boolean;
  /**
   * That residence was in Newfoundland and Labrador rather than elsewhere in
   * Canada, which decides whether the person is on the (n) track at 1 April
   * 1949 or the (m) track at 1 January 1947. Without it, one "ordinarily
   * resident" answer would satisfy both paragraphs at once.
   */
  residentInNewfoundland?: boolean;
  /** Naturalised in Canada / Newfoundland before the pivot date. (k), (l), (m), (n). */
  naturalizedInCanada?: boolean;
  /**
   * Had "Canadian domicile", five years' residence after being landed, on the
   * pivot date. Someone who had it became a citizen under the 1946 Act and so is
   * outside (m) and (n), which catch only those who did not.
   */
  canadianDomicileOnPivot?: boolean;
  /** Made a declaration of alienage before the pivot date. Bars 3(2.1)(a), 3(2.3)(a). */
  declarationOfAlienage?: boolean;
  /** Was granted or acquired Canadian citizenship at some point. */
  citizenshipByGrant?: boolean;
  /** Renounced Canadian citizenship under any of clauses 3(1)(f)(i)(A) to (F). */
  renouncedCitizenship?: boolean;
  /**
   * Lost Canadian citizenship and later resumed it, or failed to retain it under
   * the former s. 8 retention rule. This is (f)/(h)/(i)/(j) territory; v1 stops.
   */
  lostAndRestored?: boolean;
  /** Was adopted. Breaks descent logic; v1 stops. */
  adopted?: boolean;
  /**
   * A birth abroad registered with Canadian authorities under the 1946 or 1952
   * Act, which made the person a citizen from birth at the time. Rare, and it is
   * what separates (d) from (g).
   */
  birthAbroadRegistered?: boolean;
  /** At this person's birth, a parent was in Crown service abroad. s. 3(5)(a). */
  crownServiceParent?: boolean;
  /** At their parent's birth, a grandparent was in Crown service abroad. s. 3(5)(b). */
  crownServiceGrandparent?: boolean;
  /**
   * Days the citizen parent was physically present in Canada before this
   * person's birth. Only consulted for births on or after the C-3 coming into
   * force, s. 3(3)(a)(ii) and (b)(ii).
   */
  presenceDaysInCanada?: number;
  /** Has been issued a Canadian citizenship certificate. Breaks the processing pause. */
  certificateIssued?: boolean;
  /** At this person's birth, a parent was a foreign diplomat in Canada. s. 3(2). */
  foreignDiplomatParent?: boolean;
};

export type FactId = keyof PersonFacts;

/** One person in the line. */
export type Person = {
  /** Stable within a chain. Used by every trace, flag and assumption. */
  id: string;
  /** Whatever the user calls them, "Grandmother", "G1". Never leaves the browser. */
  label?: string;
  birthDate: IsoDate;
  birthRegion: BirthRegion;
  /** Omit if unknown; the engine will say so where it matters. */
  deathDate?: IsoDate;
  facts?: PersonFacts;
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * `undetermined` means "cannot answer without more information", never
 * "probably fine". `stopped` means the chain contains something v1 declines to
 * model rather than guess at.
 *
 * `incomplete` is a chain-level verdict and never appears on a person: the line
 * as entered contains no anchor at all, so there is nothing to reason from yet.
 * It is kept apart from `fails` because "you have not finished describing your
 * family" is not the same answer as "you are not a citizen", and an interview
 * that walks backwards from the applicant passes through that state on every
 * screen but the last.
 */
export type Outcome =
  | "qualifies"
  | "fails"
  | "undetermined"
  | "stopped"
  | "incomplete";

/** Which amending Act put this person inside s. 3(1). Drives the advisory layer. */
export type Amendment = "c-37" | "c-24" | "c-3" | "pre-existing";

/** One line of the reasoning, citing the provision and a source in `SOURCES`. */
export type RuleTrace = {
  /** `3(1)(k)`, `3(6.3)`, `3(7)(j)`, whatever this line is about. */
  provision: string;
  /** An `id` from `src/lib/sources.ts`. */
  sourceId: string;
  kind: "matched" | "not-matched" | "unknown" | "barred" | "superseded" | "note";
  /** Plain language, suitable for pasting into a cover letter. */
  because: string;
};

/** A default the engine applied because the fact was not asked. */
export type Assumption = {
  personId: string;
  factId: FactId | null;
  /** "no declaration of alienage before 1 January 1947" */
  statement: string;
  why: string;
  documents: string[];
  /**
   * Whether flipping this default changes the applicant's answer, found by
   * re-running the chain with it inverted.
   *
   * `true` means this is worth going and establishing; `false` means it was
   * assumed but carried nothing. `undefined` means it was not assessed, which
   * currently happens only for the assumption that someone with no recorded
   * date of death was still alive: there is no single inverse of that to test,
   * though a death before 1947 genuinely can decide a paragraph.
   */
  decisive?: boolean;
};

/** A fact with no safe default that has not been supplied. */
export type MissingFact = {
  personId: string;
  factId: FactId;
  question: string;
  why: string;
  documents: string[];
};

export type UncertaintyFlagId =
  | "consecutive-q"
  | "first-gen-reading"
  | "s1_5-reach"
  | "cohort-2-death"
  | "judgment-call";

export type UncertaintyFlag = {
  id: UncertaintyFlagId;
  personId: string;
  title: string;
  detail: string;
  sourceId: string;
};

export type StopReasonId =
  | "adoption"
  | "loss-and-restoration"
  | "citizen-by-grant"
  | "ancestor-stopped";

export type StopReason = {
  id: StopReasonId;
  personId: string;
  title: string;
  detail: string;
  /** Where to read about it. */
  provision: string;
  sourceId: string;
};

export type AdvisoryId =
  | "processing-pause"
  | "excluded-cohort-consecutive-q"
  | "excluded-cohort-death";

export type Advisory = {
  id: AdvisoryId;
  title: string;
  detail: string;
  /** The thing the user can actually do about it, where there is one. */
  action?: string;
  orgId?: string;
  sourceId: string;
  personIds: string[];
};

/** What the engine concluded about one person. */
export type Status = {
  personId: string;
  label: string;
  /** Copied through so downstream rules and advisories need only the Status. */
  birthDate: IsoDate;
  deathDate: IsoDate | null;
  outcome: Outcome;
  /**
   * The winning paragraph. Null when the person is a citizen otherwise than
   * under a paragraph of s. 3(1) as it now reads, someone who simply became a
   * citizen on 1 January 1947 under the 1946 Act and died before 1977 is a
   * citizen, and is a valid (q) parent, but no current paragraph describes them.
   */
  paragraph: Paragraph | null;
  /** When citizenship takes effect, after the 3(7) deeming rules. */
  effectiveDate: IsoDate | null;
  /** `3(7)(k)`, or null where the paragraph has no deeming rule. */
  deemingProvision: string | null;
  remediedBy: Amendment | null;
  /** Became a citizen on 1947-01-01 under the 1946 Act, the literal (q) parent test. */
  became1947ActCitizen: boolean;
  /** Became a citizen on 1949-04-01 under s. 44A, the literal (r) parent test. */
  became1949ActCitizen: boolean;
  /** 0 for a birth in Canada or Newfoundland, 1 for the first generation abroad. */
  generationAbroad: number;
  /** Paragraphs that also matched but lost to 3(6.3), 3(6.4) or the tie-break. */
  alternatives: Paragraph[];
  stopReason: StopReason | null;
  trace: RuleTrace[];
  flags: UncertaintyFlag[];
  assumptions: Assumption[];
  missing: MissingFact[];
  /** IRCC's processing-queue identifier, where the ATIP table has one. */
  orgId: OrgId | null;
};

/** An entry from the ORG ID table at ATIP pp. 63-65. */
export type OrgId = {
  /** Thirteen characters beginning with a capital letter O, not a zero. */
  id: string;
  name: string;
  criteria: string[];
};

/** The answer, led by the applicant. */
export type Headline = {
  /** The applicant's outcome, restated for someone who reads one line. */
  verdict: Outcome;
  paragraph: Paragraph | null;
  effectiveDate: IsoDate | null;
  /**
   * `clear`: nothing flagged, nothing assumed that could flip it.
   * `flagged`: an answer, but resting on a contested reading or an assumption.
   * `unknown`: no answer without more facts.
   */
  confidence: "clear" | "flagged" | "unknown";
  summary: string;
};

export type ChainResult = {
  /** One per person, in the order given: oldest first. */
  statuses: Status[];
  applicant: Status;
  /**
   * Where the applicant sits in `statuses`. The last entry unless the caller
   * said otherwise, which it does once a line has descendants in it: everything
   * after this index is a child, grandchild, and so on.
   */
  applicantIndex: number;
  headline: Headline;
  /** Chain-level, not attributable to a single person. */
  advisories: Advisory[];
  /** Everything assumed anywhere in the chain, deduplicated. */
  assumptions: Assumption[];
  /** Everything still unanswered anywhere in the chain, deduplicated. */
  missing: MissingFact[];
  flags: UncertaintyFlag[];
};
