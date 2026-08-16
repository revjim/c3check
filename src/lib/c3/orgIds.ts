/**
 * IRCC's ORG ID table, ATIP release 1A-2025-14201 at pp. 63–65.
 *
 * ORG IDs route a proof application into a processing category. They are a
 * stop-gap: "ORG IDs are being used to track C-3 related proof applications
 * until GCMS changes can be implemented." They are worth surfacing because they
 * are the one place IRCC states, in its own words, which paragraph it thinks a
 * person falls under and what it expects to see.
 *
 * The leading character of every ID is a capital letter **O**, not a zero. The
 * PDF's text layer is OCR and renders it as `0`; the page image does not. Both
 * were checked before this table was typed.
 *
 * The table covers only the paragraphs that generate C-3 proof applications.
 * There is no ORG ID for (k), (l), (m), (n), (o) or (p) — an ancestor classified
 * under those is not themselves the applicant. IRCC's own instruction for a gap
 * is "Contact Program Guidance if an applicant is a citizen as a result of
 * changes to the Citizenship Act enacted through Bill C-3 but there is not an
 * applicable ORG ID."
 */

import { AMEND_2009, ACT_1977, CIF, isBefore, isOnOrAfter } from "./dates";
import type { IsoDate } from "./dates";
import type { OrgId, Paragraph } from "./types";

/**
 * Every row in the table shares this qualifier, so it is applied once here
 * rather than repeated in each entry: an ORG ID is assigned to an applicant
 * born abroad in the second or subsequent generation.
 */
const GENERATION_2_PLUS = 2;

/** ATIP p. 63, row 1. */
const B_1977_2009: OrgId = {
  id: "O181359896802",
  name: "3(1)(b) Born 77-09 Parent C-3",
  criteria: [
    "Persons described under 3(1)(b)",
    "Born in Generation 2+ abroad",
    "Born between Feb 15, 1977 and April 16, 2009",
    "Parent remedied by C-3 or previous legislation",
  ],
};

/** ATIP p. 64. */
const B_2009_CIF: OrgId = {
  id: "O181363773548",
  name: "3(1)(b) Born 09-25 C-3 claim",
  criteria: [
    "Persons described under 3(1)(b)",
    "Born in Generation 2+ abroad",
    "Born between April 17, 2009 and CIF (minus 1 day)",
    "No Crown Servant exception",
  ],
};

/** ATIP p. 64. */
const B_POST_CIF: OrgId = {
  id: "O181367938988",
  name: "3(1)(b) Born post 25 C-3 claim",
  criteria: [
    "Persons described under 3(1)(b)",
    "Born in Generation 2+ abroad",
    "Born on or after CIF",
    "No Crown Servant exception",
  ],
};

/**
 * The fixed rows. (b) is handled separately because its ID depends on the birth
 * date; (f), (h), (i) and (j) are here for completeness even though v1 detects
 * and stops on them, so that the table matches the release.
 */
const BY_PARAGRAPH: Partial<Record<Paragraph, OrgId>> = {
  f: {
    id: "O181367939362",
    name: "3(1)(f) Restoration C-3",
    criteria: [
      "Persons described under 3(1)(f)",
      "Lost citizenship under former section 8",
      "Did not resume citizenship before April 17, 2009",
    ],
  },
  g: {
    id: "O181367939516",
    name: "3(1)(g) Born out 47-77/C-3",
    criteria: [
      "Persons described under 3(1)(g)",
      "Born in Generation 2+ abroad",
      "Born between Jan 1, 1947 and Feb 14, 1977",
      "Was not a citizen before April 17, 2009",
      "Parent remedied by C-3 or previous legislation",
    ],
  },
  h: {
    id: "O181367939720",
    name: "3(1)(h) 47-77/Grant/C-3",
    criteria: [
      "Persons described under 3(1)(h)",
      "Born in Generation 2+ abroad",
      "Born before February 15, 1977",
      "Granted citizenship before April 17, 2009",
    ],
  },
  i: {
    id: "O181369685964",
    name: "3(1)(i) Loss pre-77/C-3",
    criteria: [
      "Persons described under 3(1)(i)",
      "Lost citizenship under former section 8",
      "Resumed citizenship before April 17, 2009",
    ],
  },
  j: {
    id: "O181369686268",
    name: "3(1)(j) loss pre-77/C-3",
    criteria: [
      "Persons described under 3(1)(j)",
      "Born in Generation 2+ abroad",
      "Born before Feb 15, 1977",
      "Former citizen by operation of law under 1947 Act",
      "Resumed citizenship through the 1947 Act",
    ],
  },
  q: {
    id: "O181369686362",
    name: "3(1)(q) pre-47/Par CC/C-3",
    criteria: [
      "Persons described under 3(1)(q)",
      "Born in Generation 2+ abroad",
      "Born before Jan 1, 1947",
      "Did not become a citizen on Jan 1, 1947",
      "Parent became a citizen on Jan 1, 1947",
    ],
  },
  r: {
    id: "O181369686426",
    name: "3(1)(r) pre-49/Par CC/C-3",
    criteria: [
      "Person described under 3(1)(r)",
      "Born in Generation 2+ abroad",
      "Born before April 1, 1949",
      "Did not become a citizen on April 1, 1949",
      "Parent became a citizen on April 1, 1949",
    ],
  },
};

/**
 * The processing-pause ORG ID from the 11 December 2025 program bulletin,
 * ATIP p. 157. Attached to the file, not to a paragraph: "Add ORG ID
 * O182884345242" and send a Notice of Delay.
 */
export const PROCESSING_PAUSE_ORG_ID = "O182884345242";

/**
 * The ORG ID for a classified person, or null if the table has none for them.
 *
 * Returns null below the second generation abroad, because every row in the
 * table is qualified by "Born in Generation 2+ abroad".
 */
export function orgIdFor(
  paragraph: Paragraph | null,
  generationAbroad: number,
  birthDate: IsoDate,
): OrgId | null {
  if (paragraph === null) return null;
  if (generationAbroad < GENERATION_2_PLUS) return null;

  if (paragraph === "b") {
    if (isBefore(birthDate, ACT_1977)) return null;
    if (isBefore(birthDate, AMEND_2009)) return B_1977_2009;
    if (isBefore(birthDate, CIF)) return B_2009_CIF;
    return isOnOrAfter(birthDate, CIF) ? B_POST_CIF : null;
  }

  return BY_PARAGRAPH[paragraph] ?? null;
}

/** Every ID in the table, for the tests that guard against typos. */
export const ALL_ORG_IDS: OrgId[] = [
  B_1977_2009,
  B_2009_CIF,
  B_POST_CIF,
  ...Object.values(BY_PARAGRAPH),
];
