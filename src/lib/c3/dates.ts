/**
 * Dates and date arithmetic for the classifier.
 *
 * Dates are ISO `YYYY-MM-DD` strings, never `Date` objects. Two reasons:
 * a `Date` carries a time zone, and a birth on 1947-01-01 in Halifax must not
 * become 1946-12-31 because the browser is in Vancouver; and zero-padded ISO
 * strings compare correctly with `<`, so the comparators below are exact.
 *
 * Nothing here reads the system clock. The engine is a pure function of the
 * facts it is given, "today" is never one of them.
 */

import type { BirthRegion, BirthplaceClass } from "./types";

/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates and returns an ISO date, throwing on anything else. */
export function isoDate(value: string): IsoDate {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Not an ISO YYYY-MM-DD date: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Whether a string is a real day on the calendar, not merely ISO-shaped.
 *
 * `isoDate` above checks the shape and nothing else, which is correct for its
 * job: it guards the engine's inputs, and every date the engine holds has
 * already come from somewhere that validated it. But `1931-02-31` passes that
 * shape check and then compares as a real date, sorting after `1931-02-28` and
 * before `1931-03-01`, so it would silently produce a paragraph rather than an
 * error. Both hand-typed dates and GEDCOM dates need the real check, so it
 * lives here, beside the shape one, where a reader will look for it.
 *
 * Gregorian throughout, including for dates before the calendar was adopted
 * wherever the birth happened. The Act itself is written in Gregorian dates and
 * the engine only ever compares against those, so a proleptic reading is the
 * one that gives the right answer either side of 1 January 1947.
 */
export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** Days in a month, Gregorian. `month` is 1-12; behaviour outside that is undefined. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export const isBefore = (a: IsoDate, b: IsoDate): boolean => a < b;
export const isAfter = (a: IsoDate, b: IsoDate): boolean => a > b;
export const isOnOrBefore = (a: IsoDate, b: IsoDate): boolean => a <= b;
export const isOnOrAfter = (a: IsoDate, b: IsoDate): boolean => a >= b;
export const earlier = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);

// ---------------------------------------------------------------------------
// The dates the Act turns on
// ---------------------------------------------------------------------------

/**
 * The Canadian Citizenship Act, S.C. 1946, c. 15 came into force. Before this
 * day there was no such thing as a Canadian citizen, only British subjects.
 */
export const ACT_1947: IsoDate = "1947-01-01";

/**
 * Newfoundland and Labrador joined Confederation. Section 44A of the 1946 Act
 * (added by S.C. 1949, c. 6) made Newfoundlanders citizens on this day, which
 * is why the Act carries a parallel (l)/(n)/(p)/(r) set keyed to it.
 */
export const NFLD_UNION: IsoDate = "1949-04-01";

/**
 * The current Citizenship Act came into force. Paragraphs (a) and (b) speak of
 * births "after February 14, 1977"; (d) and (g) of the position "immediately
 * before"/"before" February 15, 1977. Both edges are this date.
 */
export const ACT_1977: IsoDate = "1977-02-15";

/** Bill C-37 (S.C. 2008, c. 14) came into force, paragraphs (f) through (j). */
export const AMEND_2009: IsoDate = "2009-04-17";

/** Bill C-24 (S.C. 2014, c. 22) came into force, paragraphs (k) through (r). */
export const AMEND_2015: IsoDate = "2015-06-11";

/** Bill C-3 (S.C. 2025, c. 5) came into force. "CIF" throughout IRCC's material. */
export const CIF: IsoDate = "2025-12-15";

/**
 * Days of physical presence in Canada a citizen parent must have accumulated
 * before the birth for 3(3) not to bite, s. 3(3)(a)(ii) and (b)(ii).
 */
export const PRESENCE_DAYS = 1095;

// ---------------------------------------------------------------------------
// Place
// ---------------------------------------------------------------------------

/**
 * Where a birth counts as having happened, *as at the date it happened*.
 *
 * Newfoundland and Labrador is the Act's only geographic carve-out: before the
 * union it was not Canada, and a birth there routes to the entirely separate
 * (l)/(n)/(p)/(r) set. A naive string match on "Canada" silently produces wrong
 * answers for every Newfoundland chain, which is why this takes a date.
 *
 * Subsection 3(1.01) points the same way from the other direction: it has to
 * say expressly that "Canada" in (k), (m) and (o) to (r) means Canada as it was
 * immediately before the union, which it would not need to say if Newfoundland
 * were already excluded everywhere.
 */
export function resolvePlace(region: BirthRegion, on: IsoDate): BirthplaceClass {
  switch (region) {
    case "outside":
      return "abroad";
    case "canada":
      return "canada";
    case "newfoundland":
      return isOnOrAfter(on, NFLD_UNION) ? "canada" : "newfoundland";
  }
}

/**
 * The date a person's pre-citizenship status is measured against: 1947-01-01
 * for Canada, 1949-04-01 for pre-union Newfoundland.
 */
export function pivotFor(place: BirthplaceClass): IsoDate {
  return place === "newfoundland" ? NFLD_UNION : ACT_1947;
}
