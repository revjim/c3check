import { describe, expect, it } from "vitest";
import { describeGedcomDate, parseGedcomDate } from "@/lib/gedcom/dates";

/**
 * One `it` per rule. Getting any of these wrong moves a birth across a
 * statutory boundary without anybody being told, which is the single most
 * consequential failure this tool can have.
 */
describe("parseGedcomDate", () => {
  it("reads a full day exactly", () => {
    expect(parseGedcomDate("12 JUN 1931")).toEqual({
      kind: "exact",
      iso: "1931-06-12",
      text: "12 JUN 1931",
    });
  });

  it("accepts a lower-case month, because exporters write one", () => {
    const date = parseGedcomDate("12 jun 1931");
    expect(date.kind).toBe("exact");
    expect(date.kind === "exact" && date.iso).toBe("1931-06-12");
  });

  it("reads a month and year to the first of the month, marked approximate", () => {
    expect(parseGedcomDate("JUN 1931")).toEqual({
      kind: "approximate",
      iso: "1931-06-01",
      precision: "month",
      qualifier: null,
      text: "JUN 1931",
    });
  });

  it("reads a bare year to 1 January, marked approximate", () => {
    // The commonest case in an old tree, and the one that most often lands on
    // the wrong side of 1 January 1947 if it is treated as a fact.
    expect(parseGedcomDate("1931")).toEqual({
      kind: "approximate",
      iso: "1931-01-01",
      precision: "year",
      qualifier: null,
      text: "1931",
    });
  });

  it("keeps the qualifier from an ABT date", () => {
    const date = parseGedcomDate("ABT 1946");
    expect(date).toEqual({
      kind: "approximate",
      iso: "1946-01-01",
      precision: "year",
      qualifier: "ABT",
      text: "ABT 1946",
    });
  });

  it("keeps EST, CAL, BEF and AFT apart from one another", () => {
    for (const qualifier of ["EST", "CAL", "BEF", "AFT"] as const) {
      const date = parseGedcomDate(`${qualifier} 12 JUN 1931`);
      expect(date.kind, qualifier).toBe("approximate");
      expect(date.kind === "approximate" && date.qualifier, qualifier).toBe(
        qualifier,
      );
      expect(date.kind === "approximate" && date.iso, qualifier).toBe(
        "1931-06-12",
      );
    }
  });

  it("takes the earlier bound of a range", () => {
    // Earlier rather than later because it is the conservative choice against
    // the 1947 and 1949 pivots: it errs towards the paragraph set that asks
    // more questions rather than fewer.
    expect(parseGedcomDate("BET 1930 AND 1935")).toEqual({
      kind: "approximate",
      iso: "1930-01-01",
      precision: "year",
      qualifier: "BET",
      text: "BET 1930 AND 1935",
    });
  });

  it("takes the start of a period", () => {
    const date = parseGedcomDate("FROM 1930 TO 1935");
    expect(date.kind === "approximate" && date.iso).toBe("1930-01-01");
    expect(date.kind === "approximate" && date.qualifier).toBe("FROM");
  });

  it("resolves a dual-dated year to the later one, and says it did", () => {
    // Before the calendar reform England ran the legal year from 25 March, so
    // January to March of what we call 1732 was written 1731/32. The two
    // conventions differ by a whole year.
    const date = parseGedcomDate("15 FEB 1731/32");
    expect(date).toEqual({
      kind: "approximate",
      iso: "1732-02-15",
      precision: "day",
      qualifier: null,
      text: "15 FEB 1731/32",
      dualDated: true,
    });
  });

  it("handles a dual year written out in full", () => {
    const date = parseGedcomDate("1731/1732");
    expect(date.kind === "approximate" && date.iso).toBe("1732-01-01");
  });

  it("refuses a Julian date rather than converting it", () => {
    const date = parseGedcomDate("@#DJULIAN@ 12 JUN 1731");
    expect(date.kind).toBe("unparsed");
    expect(date.kind === "unparsed" && date.reason).toContain("Julian");
  });

  it("refuses a Hebrew date rather than converting it", () => {
    const date = parseGedcomDate("@#DHEBREW@ 5 TSH 5692");
    expect(date.kind).toBe("unparsed");
    expect(date.kind === "unparsed" && date.reason).toContain("Hebrew");
  });

  it("accepts an explicit Gregorian escape", () => {
    const date = parseGedcomDate("@#DGREGORIAN@ 12 JUN 1931");
    expect(date.kind === "exact" && date.iso).toBe("1931-06-12");
  });

  it("never guesses at a French or German month name", () => {
    // MAI is May in German and March in nothing; JUIN could be a typo for JUN.
    for (const text of ["12 MAI 1931", "12 JUIN 1931", "12 MARZ 1931"]) {
      const date = parseGedcomDate(text);
      expect(date.kind, text).toBe("unparsed");
      expect(date.kind === "unparsed" && date.reason, text).toContain(
        "not one of the English abbreviations",
      );
    }
  });

  it("refuses a day that does not exist, which isoDate would not catch", () => {
    const date = parseGedcomDate("31 FEB 1931");
    expect(date.kind).toBe("unparsed");
    expect(date.kind === "unparsed" && date.reason).toContain("no such day");
  });

  it("refuses a 29 February in a year that did not have one", () => {
    expect(parseGedcomDate("29 FEB 1931").kind).toBe("unparsed");
    expect(parseGedcomDate("29 FEB 1932").kind).toBe("exact");
  });

  it("treats a free-text date as a note about a date", () => {
    const date = parseGedcomDate("(sometime in the war)");
    expect(date.kind).toBe("unparsed");
  });

  it("reads an INT date and keeps the qualifier", () => {
    const date = parseGedcomDate("INT 12 JUN 1931 (from a family bible)");
    expect(date.kind === "approximate" && date.iso).toBe("1931-06-12");
    expect(date.kind === "approximate" && date.qualifier).toBe("INT");
  });

  it("returns unparsed for an empty or nonsense value", () => {
    expect(parseGedcomDate("").kind).toBe("unparsed");
    expect(parseGedcomDate("   ").kind).toBe("unparsed");
    expect(parseGedcomDate("who knows").kind).toBe("unparsed");
  });

  it("keeps the raw text on every outcome, so the screen can show it", () => {
    for (const text of ["12 JUN 1931", "ABT 1946", "@#DJULIAN@ 1700"]) {
      expect(parseGedcomDate(text).text, text).toBe(text);
    }
  });
});

describe("describeGedcomDate", () => {
  it("says an exact date is exact", () => {
    expect(describeGedcomDate(parseGedcomDate("12 JUN 1931"))).toContain(
      "exactly",
    );
  });

  it("says out loud that a year-only date has had a day invented", () => {
    const described = describeGedcomDate(parseGedcomDate("ABT 1946"));
    expect(described).toContain("about this date");
    expect(described).toContain("only the year is given");
  });

  it("says which end of a range was taken", () => {
    expect(describeGedcomDate(parseGedcomDate("BET 1930 AND 1935"))).toContain(
      "earlier end",
    );
  });

  it("passes the refusal through for an unparsed date", () => {
    expect(describeGedcomDate(parseGedcomDate("@#DJULIAN@ 1700"))).toContain(
      "Julian",
    );
  });
});
