import { describe, expect, it } from "vitest";
import {
  ACT_1947,
  ACT_1977,
  CIF,
  NFLD_UNION,
} from "@/lib/c3/dates";
import {
  BOUNDARIES,
  DEFAULT_WINDOW_DAYS,
  boundariesNearYear,
  dayNumber,
  daysBetween,
  nearBoundary,
} from "@/lib/precision";
import { formatDate } from "@/lib/format";

describe("day arithmetic", () => {
  it("counts an ordinary interval", () => {
    expect(daysBetween("1947-01-01", "1947-01-02")).toBe(1);
    expect(daysBetween("1947-01-02", "1947-01-01")).toBe(-1);
    expect(daysBetween(ACT_1947, ACT_1947)).toBe(0);
  });

  it("counts a leap day", () => {
    expect(daysBetween("1932-02-28", "1932-03-01")).toBe(2);
    expect(daysBetween("1931-02-28", "1931-03-01")).toBe(1);
  });

  it("counts across a century that is not a leap year", () => {
    expect(daysBetween("1900-02-28", "1900-03-01")).toBe(1);
    expect(daysBetween("2000-02-28", "2000-03-01")).toBe(2);
  });

  it("counts a full year", () => {
    expect(daysBetween("1946-01-01", "1947-01-01")).toBe(365);
    expect(daysBetween("1948-01-01", "1949-01-01")).toBe(366);
  });

  it("does not shift a day for a time zone, because it never builds a Date", () => {
    // The whole reason this is integer arithmetic. A birth on 1947-01-01 in
    // Halifax must not become 1946-12-31 because the browser is in Vancouver.
    expect(dayNumber("1947-01-01") - dayNumber("1946-12-31")).toBe(1);
  });

  it("gives NaN for anything that is not a date", () => {
    expect(Number.isNaN(dayNumber("not a date"))).toBe(true);
  });
});

describe("nearBoundary", () => {
  it("warns about 1947 for a birth said to be about 1946", () => {
    // The case this exists for. "About 1946" is stored as 1946-01-01, and
    // whether the birth was really before or after 1 January 1947 decides
    // whether the person is a (k) or simply a citizen from 1947.
    const near = nearBoundary("1946-01-01");
    expect(near.map((b) => b.date)).toContain(ACT_1947);
  });

  it("warns about 1947 from the other side too", () => {
    expect(nearBoundary("1947-06-01").map((b) => b.date)).toContain(ACT_1947);
  });

  it("catches a December birth against the following January boundary", () => {
    // A window of a year exactly would miss this, which is why it is 400 days.
    expect(daysBetween("1946-12-15", ACT_1947)).toBeLessThan(
      DEFAULT_WINDOW_DAYS,
    );
    expect(nearBoundary("1946-12-15").map((b) => b.date)).toContain(ACT_1947);
  });

  it("stays quiet for a date nowhere near anything", () => {
    expect(nearBoundary("1890-06-01")).toEqual([]);
  });

  it("reports every boundary in range, not just the nearest", () => {
    // 1947 and 1949 are 821 days apart, so the default window never catches
    // both; widen it and a 1948 birth is genuinely uncertain against each.
    const near = nearBoundary("1948-03-01", 500);
    expect([...near.map((b) => b.date)].sort()).toEqual(
      [ACT_1947, NFLD_UNION].sort(),
    );
  });

  it("puts the closest boundary first", () => {
    const near = nearBoundary("1948-06-01");
    expect(near[0].date).toBe(NFLD_UNION);
  });

  it("says nothing about a date that is not a real day", () => {
    expect(nearBoundary("1947-02-31")).toEqual([]);
    expect(nearBoundary("")).toEqual([]);
  });

  it("honours a window given by the caller", () => {
    expect(nearBoundary("1946-01-01", 10)).toEqual([]);
  });
});

describe("boundariesNearYear", () => {
  it("flags a year on either side of a boundary", () => {
    expect(boundariesNearYear(1946).map((b) => b.date)).toEqual([ACT_1947]);
    expect(boundariesNearYear(1948).map((b) => b.date)).toEqual([
      ACT_1947,
      NFLD_UNION,
    ]);
    expect(boundariesNearYear(1890)).toEqual([]);
  });

  it("ignores a year that is not a whole number", () => {
    expect(boundariesNearYear(Number.NaN)).toEqual([]);
    expect(boundariesNearYear(1946.5)).toEqual([]);
  });
});

describe("the boundary table", () => {
  it("covers every date the Act turns on", () => {
    expect(BOUNDARIES).toHaveLength(6);
    for (const date of [ACT_1947, NFLD_UNION, ACT_1977, CIF]) {
      expect(BOUNDARIES.map((b) => b.date)).toContain(date);
    }
  });

  it("labels each one the way the copy will read it", () => {
    const act = BOUNDARIES.find((b) => b.date === ACT_1947);
    expect(act?.label).toBe(formatDate(ACT_1947));
    expect(act?.label).toBe("1 January 1947");
  });

  it("explains what turns on every one of them", () => {
    for (const boundary of BOUNDARIES) {
      expect(boundary.matters.length, boundary.date).toBeGreaterThan(40);
    }
  });
});
