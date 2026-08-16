/**
 * Three boxes: day, month, year.
 *
 * Deliberately not `<input type="date">`. A native picker asked for a birth in
 * 1870 opens on the current month and makes the user page back eighteen
 * hundred times or fight a spinner; the format it displays is the reader's
 * locale rather than the one the report will print; and some browsers clamp the
 * year to a range that starts well after most of the people in a chain were
 * born. Three numeric boxes have none of those problems and are faster to type
 * from a certificate, which is what people are copying from.
 *
 * All the validation lives here rather than in the component, so it is covered
 * by the node test suite along with everything else that decides anything.
 */

import { daysInMonth, isValidCalendarDate } from "@/lib/c3/dates";
import { formatDate } from "@/lib/format";

export type DateParts = { day: string; month: string; year: string };

export const EMPTY_PARTS: DateParts = { day: "", month: "", year: "" };

export type DateEntry =
  /** Nothing typed at all, which is not the same as something typed wrongly. */
  | { state: "empty" }
  /** Enough typed to be sure it is wrong. */
  | { state: "invalid"; message: string }
  /** Still being typed; say nothing yet. */
  | { state: "partial" }
  | { state: "valid"; iso: string };

/** Splits a stored ISO date back into the three boxes. */
export function partsFromIso(iso: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return EMPTY_PARTS;
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

/** The year alone, for the "I only know the year" box. */
export function yearFromIso(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(0, 4) : "";
}

function pad(value: string): string {
  return value.padStart(2, "0");
}

/**
 * Reads the boxes.
 *
 * `yearOnly` is the "I only know the year" case: the day and month are filled
 * in as 1 January so the engine has something to compare, and the caller must
 * set `birthDateApproximate` so that nothing ever prints "1 January 1946" as
 * though it were a fact. See `formatBirthDate` and `nearBoundary`.
 */
export function readDateParts(
  parts: DateParts,
  yearOnly: boolean,
): DateEntry {
  const year = parts.year.trim();
  const month = yearOnly ? "1" : parts.month.trim();
  const day = yearOnly ? "1" : parts.day.trim();

  if (year === "" && month === "" && day === "") return { state: "empty" };

  if (!/^\d{1,4}$/.test(year)) {
    return { state: "invalid", message: "Enter the year as four digits." };
  }
  if (year.length < 4) return { state: "partial" };
  const yearNumber = Number(year);
  if (yearNumber < 1) {
    return { state: "invalid", message: "Enter the year as four digits." };
  }

  if (!/^\d{1,2}$/.test(month)) {
    return { state: "invalid", message: "Enter the month as a number, 1 to 12." };
  }
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return { state: "invalid", message: "There is no month numbered " + month + "." };
  }

  if (!/^\d{1,2}$/.test(day)) {
    return { state: "invalid", message: "Enter the day as a number." };
  }
  const dayNumber = Number(day);
  if (dayNumber < 1) {
    return { state: "invalid", message: "Enter the day as a number." };
  }
  const limit = daysInMonth(yearNumber, monthNumber);
  if (dayNumber > limit) {
    // Named rather than generic, because the commonest version of this is a
    // 29 February in a year that did not have one, and saying so is the fastest
    // route to the user checking the certificate again.
    return {
      state: "invalid",
      message: `There is no ${dayNumber} ${MONTH_NAMES[monthNumber - 1]} ${year}; that month had ${limit} days.`,
    };
  }

  const iso = `${year}-${pad(month)}-${pad(day)}`;
  // Belt and braces: the engine compares these as strings, so anything that
  // reaches it must be a real day.
  if (!isValidCalendarDate(iso)) {
    return { state: "invalid", message: "That is not a date." };
  }
  return { state: "valid", iso };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** What to echo back to the user once the boxes make a date. */
export function describeEntry(entry: DateEntry, yearOnly: boolean): string | null {
  if (entry.state !== "valid") return null;
  return yearOnly
    ? `About ${entry.iso.slice(0, 4)}.`
    : formatDate(entry.iso);
}
