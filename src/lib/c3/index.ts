/**
 * The classification engine.
 *
 * Pure TypeScript: no React, no I/O, no system clock. `classifyChain` takes a
 * line of descent ordered anchor-first and returns a paragraph, an effective
 * date, a citing trace, and an honest account of what it had to assume and what
 * it still does not know.
 *
 * Not legal advice, and not written by a lawyer. Every contested reading is
 * visible in the output rather than folded into the answer.
 */

export { classifyChain } from "./classify";
export {
  ACT_1947,
  ACT_1977,
  AMEND_2009,
  AMEND_2015,
  CIF,
  NFLD_UNION,
  PRESENCE_DAYS,
  isAfter,
  isBefore,
  isOnOrAfter,
  isOnOrBefore,
  isoDate,
  pivotFor,
  resolvePlace,
} from "./dates";
export type { IsoDate } from "./dates";
export { DEEMING, deemingProvisionFor, effectiveDateFor } from "./deeming";
export { DOCUMENTS } from "./documents";
export type { DocumentKey } from "./documents";
export {
  FACTS,
  FACTS_WITHOUT_DEFAULTS,
  documentsFor,
  questionFor,
} from "./facts";
export type { FactEntry } from "./facts";
export { ALL_ORG_IDS, PROCESSING_PAUSE_ORG_ID, orgIdFor } from "./orgIds";
export { TIE_BREAK_ORDER, outranks, resolvePrecedence } from "./precedence";
export { RULES } from "./rules";
export type { Rule, RuleContext, RuleVerdict } from "./rules";
export { CLASSIFIED_PARAGRAPHS, provisionOf } from "./types";
export type {
  Advisory,
  Amendment,
  Assumption,
  BirthRegion,
  BirthplaceClass,
  ChainResult,
  ClassifiedParagraph,
  FactId,
  Headline,
  MissingFact,
  OrgId,
  Outcome,
  Paragraph,
  Person,
  PersonFacts,
  RuleTrace,
  Status,
  StopReason,
  StopReasonId,
  UncertaintyFlag,
  UncertaintyFlagId,
} from "./types";
