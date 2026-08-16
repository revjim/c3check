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
