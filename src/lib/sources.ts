/**
 * Authoritative sources the classifier is built from.
 *
 * Single source of truth: the rule engine cites these by `id`, and the /sources
 * page renders them. Adding a rule that relies on a document not listed here
 * means the trace cannot cite it; add the source first.
 */

export type SourceKind =
  | "statute"
  | "bill"
  | "case"
  | "guidance"
  | "commentary";

export type Source = {
  id: string;
  title: string;
  citation: string;
  url: string;
  kind: SourceKind;
  /** When the relevant provisions took effect. */
  inForce?: string;
  note?: string;
};

/**
 * The consolidation the rules are encoded against. Shown in the UI so users
 * know which version of the Act produced their result.
 */
export const ACT_AS_OF = "15 December 2025";

export const SOURCES: Source[] = [
  {
    id: "citizenship-act",
    kind: "statute",
    title: "Citizenship Act, section 3",
    citation: "R.S.C. 1985, c. C-29",
    url: "https://laws-lois.justice.gc.ca/eng/acts/c-29/section-3.html",
    note: `The operative text. Every paragraph this tool assigns, 3(1)(a) through (r), is defined here, along with the deeming provisions in 3(7) and the first-generation limit in 3(3). Consolidated text, last amended ${ACT_AS_OF}.`,
  },
  {
    id: "bill-c-3",
    kind: "bill",
    title: "An Act to amend the Citizenship Act (2025): Bill C-3",
    citation: "S.C. 2025, c. 5",
    inForce: "15 December 2025",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2025_5/",
    note: "Parliament's response to Bjorkquist. Removes the first-generation limit for everyone born abroad before it came into force, replaces it with a 1,095-day physical-presence test going forward, and adds subsection 3(1.5) for claims running through a deceased ancestor. Royal assent 20 November 2025.",
  },
  {
    id: "bill-c-24",
    kind: "bill",
    title: "Strengthening Canadian Citizenship Act: Bill C-24",
    citation: "S.C. 2014, c. 22",
    inForce: "11 June 2015",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2014_22/",
    note: "Added paragraphs 3(1)(k) through (r), the pre-1947 and pre-1949 categories that most multi-generational chains anchor on, plus the deceased-parent provisions 3(1.1)-(1.4) and the precedence rule 3(6.3).",
  },
  {
    id: "bill-c-37",
    kind: "bill",
    title: "An Act to amend the Citizenship Act: Bill C-37",
    citation: "S.C. 2008, c. 14",
    inForce: "17 April 2009",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2008_14/",
    note: "Added paragraphs 3(1)(f) through (j), restoring citizenship to many 'Lost Canadians', and introduced the first-generation limit that Bjorkquist later struck down. The 17 April 2009 date recurs throughout the Act as a dividing line.",
  },
  {
    id: "bjorkquist",
    kind: "case",
    title: "Bjorkquist et al. v. Attorney General of Canada",
    citation: "2023 ONSC 7152",
    inForce: "19 December 2023",
    url: "https://www.canlii.org/en/on/onsc/doc/2023/2023onsc7152/2023onsc7152.html",
    note: "Akbarali J. held that s. 3(3)(a) of the Citizenship Act contravenes sections 6 and 15 of the Charter and is of no force or effect, suspending the declaration for six months. Canada chose not to appeal, and Bill C-3 followed. Note that only 3(3)(a) was struck; several secondary summaries incorrectly report 3(3)(b) as well.",
  },
  {
    id: "ircc-pdi",
    kind: "guidance",
    title: "IRCC program delivery instructions: Acquisition of citizenship",
    citation: "Immigration, Refugees and Citizenship Canada",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/canadian-citizenship/acquisition.html",
    note: "IRCC's published paragraph-by-paragraph guidance. Policy, not law, but it is how applications are actually assessed, and it resolves several points the statute leaves open.",
  },
  {
    id: "atip-1a-2025-14201",
    kind: "guidance",
    title: "ATIP release 1A-2025-14201: internal C-3 procedural notes",
    citation: "157 pages, released under the Access to Information Act",
    url: "https://cdn.prod.website-files.com/6444f6b1b45963cb621883a9/6a74966e9f0dd74ffd833804_1A-2025-14201_Optimized.pdf",
    note: "Internal IRCC material: the transition guide, officer training notes, and the ORG ID table used to route applications. It also discloses two cohorts whose applications are being set aside pending further instructions. Portions are withheld under section 23.",
  },
  {
    id: "marin-atip-analysis",
    kind: "commentary",
    title:
      "Inside IRCC: 5 Things We Learned From Our Access to Information Request on Bill C-3 and Citizenship by Descent",
    citation: "Marin Immigration Law, 13 August 2026",
    url: "https://www.marinimmigrationlaw.ca/blog/inside-ircc-5-things-we-learned-from-our-access-to-information-request-on-bill-c-3-and-citizenship-by-descent",
    note: "Marin Immigration Law filed the access-to-information request that produced release 1A-2025-14201, the document this tool's rules about IRCC's internal procedure are drawn from. Credit for that release belongs to them, not to this project. Their write-up is also the fastest way to understand what is in it: five findings in plain language, including the processing pause and the disclosure that assessments may reach back to the Naturalization Act of 1868.",
  },
  {
    id: "canadianbydescent-gcms-thread",
    kind: "commentary",
    title:
      "Hypothesis: IRCC wants to determine how the Citizenship Act applies to each generation (r/CanadianbyDescent)",
    citation: "r/CanadianbyDescent, August 2026",
    url: "https://www.reddit.com/r/CanadianbyDescent/comments/1vpg2ax/hypothesis_ircc_wants_to_determine_how_the/",
    note: "Applicants comparing GCMS notes released to them under the Access to Information Act. The thread corroborates the approach this tool already took: that IRCC classifies every generation in a line under its own paragraph of section 3, not only the applicant, and it supplies the one thing corroboration cannot: a real chain, k -> o -> q -> q -> g, as an officer actually classified it. That chain is the only end-to-end check against a known-correct classification this project has, and it is what settles paragraph (o) against (q) where the Act itself is silent. Treat it accordingly: anonymous forum discussion, valuable as evidence of how particular files were decided, and not authority for anything.",
  },
];

/**
 * The source a trace line cites, or undefined if the id is unknown.
 *
 * `catalogue.test.ts` already asserts that every id cited by the rule table
 * resolves here, so in practice the undefined branch is unreachable; callers
 * still have to handle it, because a rule added without its source is exactly
 * the mistake worth degrading gracefully on rather than crashing a results page.
 */
export function sourceById(id: string): Source | undefined {
  return SOURCES.find((source) => source.id === id);
}

export const SOURCES_BY_KIND: { kind: SourceKind; label: string }[] = [
  { kind: "statute", label: "Legislation" },
  { kind: "bill", label: "Amending Acts" },
  { kind: "case", label: "Case law" },
  { kind: "guidance", label: "IRCC guidance" },
  { kind: "commentary", label: "Commentary and community" },
];
