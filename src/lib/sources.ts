/**
 * Authoritative sources the classifier is built from.
 *
 * Single source of truth: the rule engine cites these by `id`, and the /sources
 * page renders them. Adding a rule that relies on a document not listed here
 * means the trace cannot cite it — add the source first.
 */

export type SourceKind = "statute" | "bill" | "case" | "guidance";

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
    note: `The operative text. Every paragraph this tool assigns — 3(1)(a) through (r) — is defined here, along with the deeming provisions in 3(7) and the first-generation limit in 3(3). Consolidated text, last amended ${ACT_AS_OF}.`,
  },
  {
    id: "bill-c-3",
    kind: "bill",
    title: "An Act to amend the Citizenship Act (2025) — Bill C-3",
    citation: "S.C. 2025, c. 5",
    inForce: "15 December 2025",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2025_5/",
    note: "Parliament's response to Bjorkquist. Removes the first-generation limit for everyone born abroad before it came into force, replaces it with a 1,095-day physical-presence test going forward, and adds subsection 3(1.5) for claims running through a deceased ancestor. Royal assent 20 November 2025.",
  },
  {
    id: "bill-c-24",
    kind: "bill",
    title: "Strengthening Canadian Citizenship Act — Bill C-24",
    citation: "S.C. 2014, c. 22",
    inForce: "11 June 2015",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2014_22/",
    note: "Added paragraphs 3(1)(k) through (r) — the pre-1947 and pre-1949 categories that most multi-generational chains anchor on — plus the deceased-parent provisions 3(1.1)–(1.4) and the precedence rule 3(6.3).",
  },
  {
    id: "bill-c-37",
    kind: "bill",
    title: "An Act to amend the Citizenship Act — Bill C-37",
    citation: "S.C. 2008, c. 14",
    inForce: "17 April 2009",
    url: "https://laws-lois.justice.gc.ca/eng/AnnualStatutes/2008_14/",
    note: "Added paragraphs 3(1)(f) through (j), restoring citizenship to many 'Lost Canadians' — and introduced the first-generation limit that Bjorkquist later struck down. The 17 April 2009 date recurs throughout the Act as a dividing line.",
  },
  {
    id: "bjorkquist",
    kind: "case",
    title: "Bjorkquist et al. v. Attorney General of Canada",
    citation: "2023 ONSC 7152",
    inForce: "19 December 2023",
    url: "https://www.canlii.org/en/on/onsc/doc/2023/2023onsc7152/2023onsc7152.html",
    note: "Akbarali J. held that s. 3(3)(a) of the Citizenship Act contravenes sections 6 and 15 of the Charter and is of no force or effect, suspending the declaration for six months. Canada chose not to appeal, and Bill C-3 followed. Note that only 3(3)(a) was struck — several secondary summaries incorrectly report 3(3)(b) as well.",
  },
  {
    id: "ircc-pdi",
    kind: "guidance",
    title: "IRCC program delivery instructions — Acquisition of citizenship",
    citation: "Immigration, Refugees and Citizenship Canada",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/canadian-citizenship/acquisition.html",
    note: "IRCC's published paragraph-by-paragraph guidance. Policy, not law — but it is how applications are actually assessed, and it resolves several points the statute leaves open.",
  },
  {
    id: "atip-1a-2025-14201",
    kind: "guidance",
    title: "ATIP release 1A-2025-14201 — internal C-3 procedural notes",
    citation: "157 pages, released under the Access to Information Act",
    url: "https://cdn.prod.website-files.com/6444f6b1b45963cb621883a9/6a74966e9f0dd74ffd833804_1A-2025-14201_Optimized.pdf",
    note: "Internal IRCC material: the transition guide, officer training notes, and the ORG ID table used to route applications. It also discloses two cohorts whose applications are being set aside pending further instructions. Portions are withheld under section 23.",
  },
];

export const SOURCES_BY_KIND: { kind: SourceKind; label: string }[] = [
  { kind: "statute", label: "Legislation" },
  { kind: "bill", label: "Amending Acts" },
  { kind: "case", label: "Case law" },
  { kind: "guidance", label: "IRCC guidance" },
];
