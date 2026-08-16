/**
 * The fact catalogue.
 *
 * One entry per decisive fact: what to ask, why it is being asked, what the
 * engine will assume if it is not asked, and what document would settle it.
 *
 * The `defaultWhenUnasked` field is the whole design:
 *
 * - **No default.** The fact must be asked. Until it is, the person is
 *   `undetermined` and the engine names the fact and the documents. Whether the
 *   anchor naturalised abroad has no common answer, and it decides whether (k)
 *   applies at all — guessing would be worse than saying nothing.
 * - **Has a default.** The engine proceeds using it and records an assumption on
 *   the result. A declaration of alienage before 1947, Crown service, a prior
 *   renunciation: rare, decisive, and dishonest to hide. They are listed on the
 *   results and individually overridable.
 */

import type { DocumentKey } from "./documents";
import { DOCUMENTS } from "./documents";
import type { FactId } from "./types";

export type FactEntry = {
  id: FactId;
  /** Asked of one person at a time. `{person}` is substituted by the interview. */
  question: string;
  /** Why this changes the answer. Shown next to the question, not buried. */
  why: string;
  /**
   * What the engine assumes when the fact is not supplied, or `undefined` where
   * there is no safe default and the honest output is `undetermined`.
   */
  defaultWhenUnasked?: boolean | number;
  /**
   * How the assumption reads on the results page. Required wherever there is a
   * default: an assumption that cannot be stated plainly cannot be reviewed.
   */
  defaultStatement?: string;
  documents: DocumentKey;
};

export const FACTS: Record<FactId, FactEntry> = {
  ceasedBritishSubject: {
    id: "ceasedBritishSubject",
    question:
      "Before 1 January 1947 (or 1 April 1949 for Newfoundland), did {person} stop being a British subject — by becoming a citizen of another country, or, for a woman, by marrying a man who was not a British subject?",
    why: "This is what puts an ancestor born in Canada into paragraph 3(1)(k) rather than simply making them a citizen in 1947. Everything below them in the line depends on which it was.",
    // No default. There is no common answer, and it decides whether (k) applies
    // at all — the difference between a (k) anchor and no anchor.
    documents: "loss-of-british-subject-status",
  },
  britishSubjectOnPivot: {
    id: "britishSubjectOnPivot",
    question:
      "On 1 January 1947 (or 1 April 1949 for Newfoundland), was {person} a British subject?",
    why: "Paragraphs 3(1)(m) and (n) reach British subjects who were living in Canada or Newfoundland on that date but were not born or naturalised there.",
    documents: "residence-on-pivot-date",
  },
  ordinarilyResidentOnPivot: {
    id: "ordinarilyResidentOnPivot",
    question:
      "On 1 January 1947 (or 1 April 1949 for Newfoundland), was {person} ordinarily resident in Canada (or in Newfoundland and Labrador)?",
    why: "Required by paragraphs 3(1)(m) and (n). IRCC treats 'ordinarily resident' as a fact-based assessment, so a borderline answer here is flagged rather than decided.",
    documents: "residence-on-pivot-date",
  },
  residentInNewfoundland: {
    id: "residentInNewfoundland",
    question:
      "Was {person}'s residence on that date in Newfoundland and Labrador, rather than elsewhere in Canada?",
    why: "Paragraph 3(1)(m) measures residence in Canada on 1 January 1947; paragraph 3(1)(n) measures residence in Newfoundland and Labrador on 1 April 1949. Before the union these were different countries with different dates, and one answer cannot serve both.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed that any residence relied on was elsewhere in Canada, not in pre-union Newfoundland",
    documents: "residence-on-pivot-date",
  },
  naturalizedInCanada: {
    id: "naturalizedInCanada",
    question:
      "Did {person} ever naturalise in Canada (or in Newfoundland before 1 April 1949)?",
    why: "Paragraph 3(1)(k) covers people born *or naturalised* in Canada. Paragraphs (m) and (n) cover only those who were neither.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed never to have naturalised in Canada or Newfoundland",
    documents: "canadian-naturalisation",
  },
  canadianDomicileOnPivot: {
    id: "canadianDomicileOnPivot",
    question:
      "On 1 January 1947 (or 1 April 1949), did {person} have 'Canadian domicile' — five years' residence in Canada after being landed?",
    why: "A British subject who had Canadian domicile on that date became a citizen under the 1946 Act. Paragraphs (m) and (n) catch only those who did not, so this decides which side of the line they fall on.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed not to have had five years\u2019 residence after landing, and so not to have had Canadian domicile on the pivot date",
    documents: "canadian-domicile",
  },
  declarationOfAlienage: {
    id: "declarationOfAlienage",
    question:
      "Before 1 January 1947 (or 1 April 1949), did {person} make a formal declaration of alienage?",
    why: "Subsections 3(2.1)(a) and 3(2.3)(a) shut off paragraphs (k), (m), (o) and (q) — and their Newfoundland equivalents — for anyone who did.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed not to have made a declaration of alienage",
    documents: "declaration-of-alienage",
  },
  citizenshipByGrant: {
    id: "citizenshipByGrant",
    question:
      "Was {person} ever granted Canadian citizenship, or did they acquire it by application?",
    why: "A grant is a different mechanism from citizenship by operation of law: it takes effect from the date of the grant, not retroactively. It also triggers the bars in subsections 3(2.1) to 3(2.5) if the person later renounced.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed never to have been granted Canadian citizenship",
    documents: "canadian-citizenship-record",
  },
  renouncedCitizenship: {
    id: "renouncedCitizenship",
    question: "Did {person} ever renounce their Canadian citizenship?",
    why: "Every one of the five bar provisions — 3(2.1) through 3(2.5) — turns on a grant followed by a renunciation.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed never to have renounced Canadian citizenship",
    documents: "renunciation",
  },
  lostAndRestored: {
    id: "lostAndRestored",
    question:
      "Did {person} ever lose Canadian citizenship and later get it back — including failing to retain it before their 28th birthday under the old section 8?",
    why: "That is paragraph (f), (h), (i) or (j) territory. Those paragraphs run on their own timeline, and this tool stops rather than guess at them.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed never to have lost and regained Canadian citizenship",
    documents: "loss-and-restoration",
  },
  adopted: {
    id: "adopted",
    question: "Was {person} adopted?",
    why: "Adoption breaks the descent logic this tool follows. Citizenship for an adopted person runs through a grant under section 5.1, which takes effect from the date of the grant.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed not to have been adopted",
    documents: "adoption",
  },
  birthAbroadRegistered: {
    id: "birthAbroadRegistered",
    question:
      "Was {person}'s birth abroad registered with Canadian authorities at the time, under the 1946 or 1952 Act?",
    why: "A registered birth abroad made the person a citizen from birth back then. An unregistered one is what paragraph 3(1)(g) exists to fix. Registration was uncommon, so the default is 'no'.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed that a birth abroad was never registered with Canadian authorities under the former Act",
    documents: "registration-of-birth-abroad",
  },
  crownServiceParent: {
    id: "crownServiceParent",
    question:
      "When {person} was born, was either parent working outside Canada for the Canadian Armed Forces, the federal public service, or a provincial public service — other than as locally engaged staff?",
    why: "Subsection 3(5)(a) removes the 1,095-day physical-presence requirement entirely for the child of someone in Crown service abroad.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed that no parent was in Crown service abroad at the birth",
    documents: "crown-service",
  },
  crownServiceGrandparent: {
    id: "crownServiceGrandparent",
    question:
      "When {person}'s Canadian parent was born, was either of *their* parents working outside Canada in Crown service, other than as locally engaged staff?",
    why: "Subsection 3(5)(b) extends the same exception one generation further, to the grandchild of someone in Crown service abroad.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed that no grandparent was in Crown service abroad at the parent\u2019s birth",
    documents: "crown-service",
  },
  presenceDaysInCanada: {
    id: "presenceDaysInCanada",
    question:
      "Before {person} was born, how many days in total had their Canadian parent been physically present in Canada?",
    why: "For births on or after 15 December 2025, subsection 3(3) requires 1,095 cumulative days. Any calendar day partly spent in Canada counts; time under a probation order, on parole or serving a sentence does not.",
    // No default. 1,095 days is the whole test for a post-C-3 birth; assuming
    // either way would invent the answer.
    documents: "physical-presence",
  },
  certificateIssued: {
    id: "certificateIssued",
    question:
      "Has {person} ever been issued a Canadian citizenship certificate?",
    why: "IRCC's 11 December 2025 bulletin pauses a file where no certificate was ever issued to the family member whose status was corrected by Bill C-24 or C-37. Obtaining one for that ancestor breaks the criterion.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed never to have been issued a Canadian citizenship certificate",
    documents: "citizenship-certificate",
  },
  foreignDiplomatParent: {
    id: "foreignDiplomatParent",
    question:
      "When {person} was born in Canada, was either parent a foreign diplomat, consular officer, or an officer of an international organisation with diplomatic immunity?",
    why: "Subsection 3(2) is the one exception to citizenship by birth on Canadian soil. It is rare, so the default is 'no'.",
    defaultWhenUnasked: false,
    defaultStatement:
      "assumed that no parent was a foreign diplomat in Canada at the birth",
    documents: "diplomatic-status",
  },
};

/** Facts with no safe default — the ones that must be asked. */
export const FACTS_WITHOUT_DEFAULTS: FactId[] = (
  Object.keys(FACTS) as FactId[]
).filter((id) => FACTS[id].defaultWhenUnasked === undefined);

/** The documents that would settle a fact. */
export function documentsFor(id: FactId): string[] {
  return DOCUMENTS[FACTS[id].documents];
}

/** Fills the `{person}` placeholder in a question. */
export function questionFor(id: FactId, personLabel: string): string {
  return FACTS[id].question.replaceAll("{person}", personLabel);
}
