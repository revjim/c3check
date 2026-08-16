/**
 * GEDCOM dates.
 *
 * The hardest part of reading a family tree, and the part with the most to lose.
 * `ABT 1946` becoming `1946-01-01` silently changes which paragraph of the Act
 * applies and the user never learns that a guess was made, so every value that
 * comes out of here carries what it was read from and how sure it is, and the
 * interview shows both.
 *
 * Two rules this file will not break:
 *
 * - **No calendar conversion, ever.** A `@#DJULIAN@` or `@#DHEBREW@` date comes
 *   back `unparsed` with its text intact. Converting one correctly needs to know
 *   which of several conventions the person who typed it was using, and getting
 *   it wrong moves a birth across 1 January 1947.
 * - **No guessing at month names.** Only the fifteen English abbreviations the
 *   spec defines are recognised. `MAI` is May in German and March in nothing;
 *   `JAN` in a French file could be `JANVIER` and could be a typo. Unparsed is
 *   the honest answer and the user can type the date they meant.
 */

import { isValidCalendarDate } from "@/lib/c3/dates";
import type { IsoDate } from "@/lib/c3";

/** How much of a date is actually known. */
export type DatePrecision = "day" | "month" | "year";

/** The GEDCOM qualifier that made a date approximate, if there was one. */
export type DateQualifier =
  | "ABT"
  | "EST"
  | "CAL"
  | "BEF"
  | "AFT"
  | "BET"
  | "FROM"
  | "TO"
  | "INT";

export type GedcomDate =
  /** A single day, stated exactly. Safe to use as a birth date as it stands. */
  | { kind: "exact"; iso: IsoDate; text: string }
  /**
   * A date that is known to be a guess, a range, or short of a full day. `iso`
   * is the earliest day it could be, filled in so the engine has something to
   * compare, and it must never be presented as though it were stated.
   */
  | {
      kind: "approximate";
      iso: IsoDate;
      precision: DatePrecision;
      qualifier: DateQualifier | null;
      text: string;
      /** A dual-numbered year, `1731/32`, resolved to the later one. */
      dualDated?: boolean;
    }
  /** Not read at all. The raw text goes on screen as a hint and nothing else. */
  | { kind: "unparsed"; text: string; reason: string };

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const QUALIFIERS: DateQualifier[] = [
  "ABT",
  "EST",
  "CAL",
  "BEF",
  "AFT",
  "BET",
  "FROM",
  "TO",
  "INT",
];

/** `@#DGREGORIAN@` and friends. Anything but Gregorian is refused outright. */
const ESCAPE = /@#D([A-Z_]+)@/;

export function parseGedcomDate(text: string): GedcomDate {
  const raw = text.trim();
  if (raw === "") return { kind: "unparsed", text, reason: "No date was given." };

  const upper = raw.toUpperCase();

  // Calendar escapes first: nothing else matters if the calendar is not ours.
  const escape = ESCAPE.exec(upper);
  if (escape !== null && escape[1] !== "GREGORIAN") {
    return {
      kind: "unparsed",
      text: raw,
      reason: `This date is written in the ${calendarName(escape[1])} calendar. Converting it needs assumptions this tool will not make, because getting one wrong can move a birth across 1 January 1947. Type the Gregorian date if you have it.`,
    };
  }
  const body = upper.replace(ESCAPE, "").trim();

  // An interpreted date, `INT 12 JUN 1931 (from a family bible)`, carries a
  // free-text phrase in brackets. So does a bare `(phrase)` date.
  if (body.startsWith("(")) {
    return {
      kind: "unparsed",
      text: raw,
      reason: "This is a note about a date rather than a date.",
    };
  }
  const withoutPhrase = body.replace(/\([^)]*\)/g, " ").trim();

  const qualifier = leadingQualifier(withoutPhrase);
  const rest =
    qualifier === null
      ? withoutPhrase
      : withoutPhrase.slice(qualifier.length).trim();

  // A range or a period takes its earliest bound. Earliest rather than latest
  // because it is the conservative choice against the 1947 and 1949 pivots: it
  // errs towards the paragraph set that asks more questions rather than fewer.
  const bounded = firstBound(rest);

  const parsed = parseDayMonthYear(bounded);
  if (parsed === null) {
    return {
      kind: "unparsed",
      text: raw,
      reason: monthNameGuess(bounded)
        ? "The month in this date is not one of the English abbreviations GEDCOM uses, and this tool will not guess at it."
        : "This date is not in a form GEDCOM defines.",
    };
  }

  if (!isValidCalendarDate(parsed.iso)) {
    return {
      kind: "unparsed",
      text: raw,
      reason: `There is no such day as ${bounded.toLowerCase()}.`,
    };
  }

  const approximate =
    qualifier !== null || parsed.precision !== "day" || parsed.dualDated;

  if (!approximate) {
    return { kind: "exact", iso: parsed.iso, text: raw };
  }

  return {
    kind: "approximate",
    iso: parsed.iso,
    precision: parsed.precision,
    qualifier,
    text: raw,
    ...(parsed.dualDated ? { dualDated: true } : {}),
  };
}

// ---------------------------------------------------------------------------

function leadingQualifier(text: string): DateQualifier | null {
  for (const qualifier of QUALIFIERS) {
    if (text === qualifier || text.startsWith(`${qualifier} `)) return qualifier;
  }
  return null;
}

/**
 * The earlier end of `BET x AND y`, or of `FROM x TO y`.
 *
 * The separator is matched with spaces around it so that a month abbreviation
 * is never mistaken for one: `AND` and `TO` are not month names, but a bare
 * `indexOf` would also match inside a phrase.
 */
function firstBound(text: string): string {
  for (const separator of [" AND ", " TO "]) {
    const at = text.indexOf(separator);
    if (at !== -1) return text.slice(0, at).trim();
  }
  return text;
}

type Parsed = { iso: IsoDate; precision: DatePrecision; dualDated: boolean };

function parseDayMonthYear(text: string): Parsed | null {
  const parts = text.split(/\s+/).filter((part) => part !== "");
  if (parts.length === 0 || parts.length > 3) return null;

  const yearPart = parts[parts.length - 1];
  const year = parseYear(yearPart);
  if (year === null) return null;

  if (parts.length === 1) {
    return {
      iso: `${pad4(year.year)}-01-01`,
      precision: "year",
      dualDated: year.dualDated,
    };
  }

  const month = MONTHS[parts[parts.length - 2]];
  if (month === undefined) return null;

  if (parts.length === 2) {
    return {
      iso: `${pad4(year.year)}-${pad2(month)}-01`,
      precision: "month",
      dualDated: year.dualDated,
    };
  }

  if (!/^\d{1,2}$/.test(parts[0])) return null;
  return {
    iso: `${pad4(year.year)}-${pad2(month)}-${pad2(Number(parts[0]))}`,
    precision: "day",
    dualDated: year.dualDated,
  };
}

/**
 * A year, allowing for dual dating.
 *
 * Before the calendar reform, England ran the legal year from 25 March, so
 * January to March of what we would call 1732 was written `1731/32`. The later
 * year is the one that matches the modern calendar, and it is flagged, because
 * the two conventions differ by a whole year and that is more than enough to
 * cross a statutory boundary.
 */
function parseYear(text: string): { year: number; dualDated: boolean } | null {
  const dual = /^(\d{3,4})\/(\d{1,4})$/.exec(text);
  if (dual !== null) {
    const first = Number(dual[1]);
    const suffix = dual[2];
    // `1731/32` means 1732; `1731/1732` says it in full.
    const second =
      suffix.length >= 3
        ? Number(suffix)
        : Number(String(first).slice(0, 4 - suffix.length) + suffix);
    return { year: second, dualDated: true };
  }
  if (!/^\d{3,4}$/.test(text)) return null;
  return { year: Number(text), dualDated: false };
}

/** Does the second-to-last token look like somebody's month name? */
function monthNameGuess(text: string): boolean {
  const parts = text.split(/\s+/).filter((part) => part !== "");
  if (parts.length < 2) return false;
  const candidate = parts[parts.length - 2];
  return /^[A-Z]{3,12}$/.test(candidate) && MONTHS[candidate] === undefined;
}

function calendarName(code: string): string {
  switch (code) {
    case "JULIAN":
      return "Julian";
    case "HEBREW":
      return "Hebrew";
    case "FRENCH_R":
      return "French Republican";
    case "ROMAN":
      return "Roman";
    default:
      return code.toLowerCase().replace(/_/g, " ");
  }
}

const pad2 = (value: number): string => String(value).padStart(2, "0");
const pad4 = (value: number): string => String(value).padStart(4, "0");

// ---------------------------------------------------------------------------

/** How to describe a parsed date on screen, in one short phrase. */
export function describeGedcomDate(date: GedcomDate): string {
  switch (date.kind) {
    case "exact":
      return "read exactly from your file";
    case "approximate": {
      const parts: string[] = [];
      if (date.qualifier !== null) parts.push(qualifierWords(date.qualifier));
      if (date.precision === "year") parts.push("only the year is given");
      if (date.precision === "month") parts.push("no day is given");
      if (date.dualDated === true) {
        parts.push("the year is dual-dated, and the later one has been taken");
      }
      return parts.length === 0 ? "approximate" : parts.join("; ");
    }
    case "unparsed":
      return date.reason;
  }
}

function qualifierWords(qualifier: DateQualifier): string {
  switch (qualifier) {
    case "ABT":
      return "your file says about this date";
    case "EST":
      return "your file says this is an estimate";
    case "CAL":
      return "your file says this was calculated rather than recorded";
    case "BEF":
      return "your file says before this date";
    case "AFT":
      return "your file says after this date";
    case "BET":
      return "your file gives a range, and the earlier end has been taken";
    case "FROM":
      return "your file gives a period, and its start has been taken";
    case "TO":
      return "your file gives a period, and its end has been taken";
    case "INT":
      return "your file says this was interpreted from something else";
  }
}
