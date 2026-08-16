import { describe, expect, it } from "vitest";
import {
  describeEntry,
  partsFromIso,
  readDateParts,
  yearFromIso,
} from "@/lib/dateEntry";

describe("readDateParts", () => {
  it("reads three boxes into an ISO date", () => {
    expect(readDateParts({ day: "2", month: "3", year: "1870" }, false)).toEqual({
      state: "valid",
      iso: "1870-03-02",
    });
  });

  it("zero-pads, because the engine compares these as strings", () => {
    const entry = readDateParts({ day: "9", month: "1", year: "1947" }, false);
    expect(entry).toEqual({ state: "valid", iso: "1947-01-09" });
  });

  it("says nothing while a year is still being typed", () => {
    expect(readDateParts({ day: "2", month: "3", year: "18" }, false)).toEqual({
      state: "partial",
    });
  });

  it("distinguishes nothing typed from something typed wrongly", () => {
    expect(readDateParts({ day: "", month: "", year: "" }, false)).toEqual({
      state: "empty",
    });
  });

  it("names the month when the day does not exist in it", () => {
    // The commonest version of this is a 29 February in a year that did not
    // have one, and naming it sends the user back to the certificate.
    const entry = readDateParts({ day: "29", month: "2", year: "1931" }, false);
    expect(entry).toEqual({
      state: "invalid",
      message: "There is no 29 February 1931; that month had 28 days.",
    });
  });

  it("accepts a real leap day", () => {
    expect(readDateParts({ day: "29", month: "2", year: "1932" }, false)).toEqual(
      { state: "valid", iso: "1932-02-29" },
    );
  });

  it("rejects a month outside 1 to 12", () => {
    expect(
      readDateParts({ day: "1", month: "13", year: "1947" }, false).state,
    ).toBe("invalid");
    expect(
      readDateParts({ day: "1", month: "0", year: "1947" }, false).state,
    ).toBe("invalid");
  });

  it("rejects anything that is not digits", () => {
    expect(
      readDateParts({ day: "1st", month: "3", year: "1947" }, false).state,
    ).toBe("invalid");
    expect(
      readDateParts({ day: "1", month: "Mar", year: "1947" }, false).state,
    ).toBe("invalid");
  });

  it("fills in 1 January when only the year is known", () => {
    // The caller must also set birthDateApproximate, or the report would print
    // "1 January 1946" as though somebody had said so.
    expect(readDateParts({ day: "", month: "", year: "1946" }, true)).toEqual({
      state: "valid",
      iso: "1946-01-01",
    });
  });

  it("ignores whatever is left in the day and month boxes in year-only mode", () => {
    expect(
      readDateParts({ day: "31", month: "2", year: "1946" }, true),
    ).toEqual({ state: "valid", iso: "1946-01-01" });
  });

  it("still wants a whole year in year-only mode", () => {
    expect(readDateParts({ day: "", month: "", year: "194" }, true)).toEqual({
      state: "partial",
    });
  });
});

describe("partsFromIso", () => {
  it("splits a stored date back into the boxes, without leading zeros", () => {
    expect(partsFromIso("1870-03-02")).toEqual({
      year: "1870",
      month: "3",
      day: "2",
    });
  });

  it("gives empty boxes for anything that is not a stored date", () => {
    expect(partsFromIso("")).toEqual({ day: "", month: "", year: "" });
    expect(partsFromIso("1870")).toEqual({ day: "", month: "", year: "" });
  });

  it("round-trips", () => {
    expect(readDateParts(partsFromIso("1949-04-01"), false)).toEqual({
      state: "valid",
      iso: "1949-04-01",
    });
  });

  it("pulls the year out on its own", () => {
    expect(yearFromIso("1946-01-01")).toBe("1946");
    expect(yearFromIso("")).toBe("");
  });
});

describe("describeEntry", () => {
  it("echoes a full date the way the report will print it", () => {
    const entry = readDateParts({ day: "2", month: "3", year: "1870" }, false);
    expect(describeEntry(entry, false)).toBe("2 March 1870");
  });

  it("never echoes a made-up day back as though it were given", () => {
    const entry = readDateParts({ day: "", month: "", year: "1946" }, true);
    expect(describeEntry(entry, true)).toBe("About 1946.");
    expect(describeEntry(entry, true)).not.toContain("January");
  });

  it("says nothing at all until there is a date", () => {
    expect(describeEntry({ state: "partial" }, false)).toBeNull();
  });
});
