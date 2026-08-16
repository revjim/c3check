/**
 * Dates that are close enough to a statutory boundary for the guesswork to
 * matter.
 *
 * An approximate birth date is the highest-consequence data-quality failure in
 * this tool. "About 1946" gets stored as `1946-01-01` and then compares as a
 * real date, so a birth that actually happened in March 1947 quietly produces
 * paragraph (k) instead of (d), with a different effective date and a different
 * cascade below it, and nothing on the screen says that the answer rests on a
 * rounding. This module is what says it.
 *
 * Pure, and clock-free like the engine: the arithmetic below converts an ISO
 * date to a day number directly rather than constructing a `Date`, which would
 * reintroduce exactly the time-zone slip that `dates.ts` exists to avoid.
 */

import {
  ACT_1947,
  ACT_1977,
  AMEND_2009,
  AMEND_2015,
  CIF,
  NFLD_UNION,
  isValidCalendarDate,
} from "@/lib/c3/dates";
import type { IsoDate } from "@/lib/c3";
import { formatDate } from "@/lib/format";

export type Boundary = {
  date: IsoDate;
  /** How the date is referred to in the copy: "1 January 1947". */
  label: string;
  /** One sentence on what turns on which side of it a birth falls. */
  matters: string;
};

/**
 * Every date in the Act that a birth can fall the wrong side of.
 *
 * Built from the exported constants rather than retyped, so that a correction
 * to one of them reaches this list too.
 */
export const BOUNDARIES: Boundary[] = [
  {
    date: ACT_1947,
    label: formatDate(ACT_1947),
    matters:
      "Before this day there were no Canadian citizens, only British subjects. A birth in Canada before it routes through paragraph (k) and turns on whether the person later stopped being a British subject; a birth on or after it made them a citizen outright.",
  },
  {
    date: NFLD_UNION,
    label: formatDate(NFLD_UNION),
    matters:
      "Newfoundland and Labrador joined Confederation on this day. A birth there before it is not a birth in Canada at all, and routes to an entirely separate set of paragraphs, (l), (n), (p) and (r), keyed to 1 April 1949 rather than 1 January 1947.",
  },
  {
    date: ACT_1977,
    label: formatDate(ACT_1977),
    matters:
      "The current Citizenship Act came into force on this day. A birth abroad before it is paragraph (g); on or after it, paragraph (b). They carry different tests and different effective dates.",
  },
  {
    date: AMEND_2009,
    label: formatDate(AMEND_2009),
    matters:
      "Bill C-37 came into force on this day, and the Act uses the date as a dividing line in several paragraphs. It also decides whether an ancestor who died was reached by the amendment that corrected their status.",
  },
  {
    date: AMEND_2015,
    label: formatDate(AMEND_2015),
    matters:
      "Bill C-24 came into force on this day, adding paragraphs (k) through (r). As with 2009, it decides whether an ancestor who died before it was reached by the amendment that corrected their status.",
  },
  {
    date: CIF,
    label: formatDate(CIF),
    matters:
      "Bill C-3 came into force on this day. The first-generation limit applies only to a birth abroad on or after it, and where it applies the citizen parent needs 1,095 days of physical presence in Canada.",
  },
];

/**
 * A day number, counting from an arbitrary fixed point.
 *
 * Howard Hinnant's `days_from_civil`, which is exact integer arithmetic over
 * the proleptic Gregorian calendar and needs no `Date`, no time zone and no
 * clock. Only differences between two of these are ever used, so the origin
 * does not matter.
 */
export function dayNumber(iso: IsoDate): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return Number.NaN;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const y = Number(match[1]) - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Whole days from `a` to `b`, negative if `b` is earlier. NaN if either is not a date. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return dayNumber(b) - dayNumber(a);
}

/**
 * The default window, in days.
 *
 * A little over a year, because the commonest approximation by far is a year
 * with no month or day. "About 1946" is stored as 1 January 1946 and the real
 * birth could be anywhere in that year or, given that "about" is itself a
 * guess, a bit either side of it. A window of a year would miss a December
 * birth against the following January boundary, which is precisely the case
 * this exists to catch.
 */
export const DEFAULT_WINDOW_DAYS = 400;

/**
 * Every statutory boundary within `windowDays` of the given date.
 *
 * Returned in date order, closest first where two are equally relevant, so the
 * screen can lead with the one most likely to bite.
 */
export function nearBoundary(
  date: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Boundary[] {
  if (!isValidCalendarDate(date)) return [];
  return BOUNDARIES.filter(
    (boundary) => Math.abs(daysBetween(date, boundary.date)) <= windowDays,
  ).sort(
    (a, b) =>
      Math.abs(daysBetween(date, a.date)) - Math.abs(daysBetween(date, b.date)),
  );
}

/**
 * The same question for a year on its own, which is what an approximate date
 * usually really is: does any boundary fall inside this calendar year or the
 * one either side of it?
 */
export function boundariesNearYear(year: number): Boundary[] {
  if (!Number.isInteger(year)) return [];
  return BOUNDARIES.filter((boundary) => {
    const boundaryYear = Number(boundary.date.slice(0, 4));
    return Math.abs(boundaryYear - year) <= 1;
  });
}
