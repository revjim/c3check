/**
 * Rendering helpers shared by the interview, the results page and the plain
 * text report.
 *
 * Dates are formatted from the ISO string by hand rather than through
 * `Intl.DateTimeFormat`. Three reasons, in order of how much damage they do:
 * constructing a `Date` from `1870-03-02` and reading it back can shift the day
 * by one in a browser west of UTC, which is the whole reason the engine never
 * touches `Date` at all; the output would change with the reader's locale, so
 * the printed report and the copied text would not match the screenshots anyone
 * files a bug with; and a locale can emit non-ASCII, which `src/ascii.test.ts`
 * forbids in source and the report promises never to produce.
 */

const MONTHS = [
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

/**
 * `1870-03-02` -> `2 March 1870`. Returns the input unchanged if it is not an
 * ISO date, because a results page is a bad place to throw.
 */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (name === undefined) return iso;
  return `${Number(day)} ${name} ${year}`;
}

/**
 * The same, with the honesty that an approximate date deserves. An "about
 * 1946" birth that the tool stored as `1946-01-01` must never render as
 * "1 January 1946" on a page someone might rely on: whether the birth fell
 * before or after 1 January 1947 can decide the paragraph.
 */
export function formatBirthDate(iso: string, approximate: boolean): string {
  if (!approximate) return formatDate(iso);
  const year = iso.slice(0, 4);
  return `about ${year}`;
}

/**
 * Long-form every ISO date inside a sentence the engine wrote.
 *
 * The engine builds prose, and the dates in it are the same `YYYY-MM-DD`
 * strings it compares with, so a headline reads "effective 1970-08-08" directly
 * above a field that says "8 August 1970". This is presentation, which the
 * engine explicitly does not do, so the fix belongs here.
 *
 * A deliberate exception to the rule that engine prose is passed through
 * untouched. That rule exists so a `because` string stays pasteable into a
 * cover letter, and swapping a date for the same date, spelled out, makes it
 * more so; nothing is truncated, reordered or reworded. The pattern is strict
 * enough that it cannot match anything else the engine emits.
 */
export function humaniseDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => formatDate(iso));
}

/** `1095` -> `1,095`. Grouping by hand, for the same reason as the dates. */
export function formatNumber(value: number): string {
  const [whole, ...rest] = String(value).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign === "-" ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return [sign + grouped, ...rest].join(".");
}

/** "1 generation" / "3 generations", so call sites stop writing the ternary. */
export function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}
