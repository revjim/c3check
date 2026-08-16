import { describe, expect, it } from "vitest";
import {
  ACT_1947,
  ACT_1977,
  AMEND_2009,
  AMEND_2015,
  CIF,
  NFLD_UNION,
  PRESENCE_DAYS,
  isAfter,
  isBefore,
  isOnOrAfter,
  isOnOrBefore,
  isValidCalendarDate,
  isoDate,
  pivotFor,
  resolvePlace,
} from "@/lib/c3/dates";

describe("comparators", () => {
  it("orders ISO strings as dates", () => {
    expect(isBefore("1946-12-31", ACT_1947)).toBe(true);
    expect(isBefore(ACT_1947, ACT_1947)).toBe(false);
    expect(isOnOrBefore(ACT_1947, ACT_1947)).toBe(true);
    expect(isAfter("1947-01-02", ACT_1947)).toBe(true);
    expect(isOnOrAfter(ACT_1947, ACT_1947)).toBe(true);
  });

  it("does not confuse a two-digit day with a one-digit one", () => {
    // The reason dates are zero-padded strings rather than anything cleverer.
    expect(isBefore("1947-01-09", "1947-01-10")).toBe(true);
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(() => isoDate("1947-1-1")).toThrow();
    expect(() => isoDate("January 1, 1947")).toThrow();
    expect(isoDate(ACT_1947)).toBe(ACT_1947);
  });
});

describe("isValidCalendarDate", () => {
  it("catches the day that is ISO-shaped but not on the calendar", () => {
    // The hole isoDate leaves open. `1931-02-31` passes the shape check and
    // then compares as a real date, so it would produce a paragraph rather
    // than an error.
    expect(isoDate("1931-02-31")).toBe("1931-02-31");
    expect(isValidCalendarDate("1931-02-31")).toBe(false);
  });

  it("accepts a real day", () => {
    expect(isValidCalendarDate("1931-02-28")).toBe(true);
    expect(isValidCalendarDate(ACT_1947)).toBe(true);
  });

  it("knows which Februaries have 29 days", () => {
    expect(isValidCalendarDate("1932-02-29")).toBe(true);
    expect(isValidCalendarDate("1931-02-29")).toBe(false);
    // Gregorian century rule, both directions.
    expect(isValidCalendarDate("1900-02-29")).toBe(false);
    expect(isValidCalendarDate("2000-02-29")).toBe(true);
  });

  it("knows the thirty-day months", () => {
    expect(isValidCalendarDate("1947-04-31")).toBe(false);
    expect(isValidCalendarDate("1947-04-30")).toBe(true);
    expect(isValidCalendarDate("1947-12-31")).toBe(true);
  });

  it("rejects a month or day out of range, and anything misshapen", () => {
    expect(isValidCalendarDate("1947-13-01")).toBe(false);
    expect(isValidCalendarDate("1947-00-01")).toBe(false);
    expect(isValidCalendarDate("1947-01-00")).toBe(false);
    expect(isValidCalendarDate("1947-1-1")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
  });
});

describe("the dates the Act turns on", () => {
  it("holds them to the day", () => {
    expect(ACT_1947).toBe("1947-01-01");
    expect(NFLD_UNION).toBe("1949-04-01");
    expect(ACT_1977).toBe("1977-02-15");
    expect(AMEND_2009).toBe("2009-04-17");
    expect(AMEND_2015).toBe("2015-06-11");
    expect(CIF).toBe("2025-12-15");
    expect(PRESENCE_DAYS).toBe(1095);
  });
});

describe("resolvePlace", () => {
  it("treats Newfoundland before the union as its own place", () => {
    expect(resolvePlace("newfoundland", "1949-03-31")).toBe("newfoundland");
  });

  it("treats Newfoundland from the day of the union as Canada", () => {
    expect(resolvePlace("newfoundland", NFLD_UNION)).toBe("canada");
    expect(resolvePlace("newfoundland", "1955-03-03")).toBe("canada");
  });

  it("leaves Canada and abroad alone whatever the date", () => {
    expect(resolvePlace("canada", "1860-01-01")).toBe("canada");
    expect(resolvePlace("outside", "2030-01-01")).toBe("abroad");
  });
});

describe("pivotFor", () => {
  it("sends pre-union Newfoundland to 1949 and everything else to 1947", () => {
    expect(pivotFor("newfoundland")).toBe(NFLD_UNION);
    expect(pivotFor("canada")).toBe(ACT_1947);
    expect(pivotFor("abroad")).toBe(ACT_1947);
  });
});
