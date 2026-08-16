/**
 * GEDCOM, line by line.
 *
 * The format is deceptively simple: `LEVEL [XREF] TAG [VALUE]`, one record per
 * line. What makes a real file awkward is everything around that. Files come
 * off Windows with `\r\n`, off classic Mac OS with bare `\r`, and out of some
 * exporters with a UTF-8 byte-order mark on the first line that turns `0` into
 * something that is not `0`. Leading whitespace before the level number is
 * illegal in every version of the spec and appears in a great many files
 * anyway. Long values are split across `CONC` and `CONT` continuation lines.
 *
 * **A malformed line is skipped and counted, never thrown.** Somebody uploading
 * a fifty-year-old family tree should get a page that says "eleven lines could
 * not be read" and carries on, not a blank screen.
 */

export type GedcomLine = {
  level: number;
  /** `@I123@`, present only on a record's first line. */
  xref: string | null;
  /** `INDI`, `BIRT`, `DATE`. Upper case in every file that follows the spec. */
  tag: string;
  value: string;
  /** 1-based, counting every physical line including the ones skipped. */
  lineNumber: number;
};

export type TokenizeResult = {
  lines: GedcomLine[];
  warnings: string[];
};

/**
 * A byte-order mark, which arrives as one character once `File.text()` has
 * decoded the bytes. Written as an escape because the source of this repository
 * is ASCII only, and because a literal one here would be invisible in every
 * editor and diff.
 */
const BOM = "\uFEFF";

/**
 * `0 @I1@ INDI`, `1 BIRT`, `2 DATE 12 JUN 1931`.
 *
 * The xref group is deliberately greedy about what it allows between the `@`
 * signs. The spec restricts the characters; exporters do not.
 */
const LINE = /^(\d+)\s+(?:(@[^@]*@)\s+)?([A-Za-z0-9_.]+)(?:\s(.*))?$/;

export function tokenizeGedcom(text: string): TokenizeResult {
  const lines: GedcomLine[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let firstSkippedAt: number | null = null;

  // One split for all three line endings. A lone `\r` is classic Mac OS and
  // still turns up in files exported by very old software.
  const physical = stripBom(text).split(/\r\n|\r|\n/);

  for (const [index, raw] of physical.entries()) {
    const lineNumber = index + 1;
    // Leading whitespace before the level is illegal and common. Trailing
    // whitespace is stripped too, but only at the ends: a value can legitimately
    // contain runs of spaces.
    const line = raw.trim();
    if (line === "") continue;

    const match = LINE.exec(line);
    if (match === null) {
      skipped += 1;
      firstSkippedAt ??= lineNumber;
      continue;
    }

    const level = Number(match[1]);
    const tag = match[3].toUpperCase();
    const value = unescapeAt(match[4] ?? "");

    // CONC joins with no separator, CONT starts a new line. Both belong to the
    // preceding line's value rather than being records of their own.
    if (tag === "CONC" || tag === "CONT") {
      const previous = lines[lines.length - 1];
      if (previous === undefined) {
        skipped += 1;
        firstSkippedAt ??= lineNumber;
        continue;
      }
      previous.value += tag === "CONC" ? value : `\n${value}`;
      continue;
    }

    lines.push({
      level,
      xref: match[2] ?? null,
      tag,
      value,
      lineNumber,
    });
  }

  if (skipped > 0) {
    warnings.push(
      `${skipped} line${skipped === 1 ? "" : "s"} could not be read and ${
        skipped === 1 ? "was" : "were"
      } skipped, starting at line ${firstSkippedAt}.`,
    );
  }
  if (lines.length === 0) {
    warnings.push("Nothing in this file looks like GEDCOM.");
  }

  return { lines, warnings };
}

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/**
 * `@@` is how a literal `@` is written in a value, because a bare `@` opens an
 * xref. Nothing else in a value is escaped.
 */
function unescapeAt(value: string): string {
  return value.replaceAll("@@", "@");
}
