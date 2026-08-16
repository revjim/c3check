import { describe, expect, it } from "vitest";
import { guessBirthRegion } from "@/lib/gedcom/places";

describe("guessBirthRegion", () => {
  it("is confident about a place that ends in Canada", () => {
    const guess = guessBirthRegion("Toronto, Ontario, Canada");
    expect(guess.region).toBe("canada");
    expect(guess.confidence).toBe("high");
  });

  it("is confident about a place that ends in a province", () => {
    for (const text of ["Halifax, Nova Scotia", "Calgary, AB", "Regina, SK"]) {
      const guess = guessBirthRegion(text);
      expect(guess.region, text).toBe("canada");
      expect(guess.confidence, text).toBe("high");
    }
  });

  it("is never confident about Newfoundland, whatever the string says", () => {
    // Two independent reasons. NL is also the ISO code for the Netherlands and
    // the postal abbreviation for the province; and the answer turns on the
    // date rather than the string, because before 1 April 1949 a birth there
    // was not a birth in Canada at all.
    for (const text of [
      "St John's, Newfoundland",
      "Labrador City, NL",
      "Corner Brook, NFLD",
      "Somewhere, NF",
    ]) {
      const guess = guessBirthRegion(text);
      expect(guess.region, text).toBe("newfoundland");
      expect(guess.confidence, text).toBe("low");
    }
  });

  it("names the historical entity rather than silently modernising it", () => {
    for (const [text, name] of [
      ["York, Upper Canada", "Upper Canada"],
      ["Montreal, Lower Canada", "Lower Canada"],
      ["Toronto, Canada West", "Canada West"],
      ["Somewhere, Rupert's Land", "Rupert's Land"],
    ] as const) {
      const guess = guessBirthRegion(text);
      expect(guess.region, text).toBe("canada");
      expect(guess.confidence, text).toBe("low");
      expect(guess.reason, text).toContain(name);
    }
  });

  it("refuses to place New France or Acadia at all", () => {
    // New France reached into present-day Louisiana and Acadia into part of
    // present-day Maine. Which side of a modern border a birth falls on
    // decides the answer, and the place name cannot say.
    for (const text of [
      "Somewhere in New France",
      "Port Royal, Acadia",
      "Quelque part, Nouvelle-France",
    ]) {
      const guess = guessBirthRegion(text);
      expect(guess.region, text).toBeNull();
      expect(guess.confidence, text).toBe("low");
    }
  });

  it("treats anything else as outside, at low confidence", () => {
    const guess = guessBirthRegion("Manchester, England");
    expect(guess.region).toBe("outside");
    expect(guess.confidence).toBe("low");
  });

  it("says nothing at all for an empty place", () => {
    expect(guessBirthRegion("").region).toBeNull();
    expect(guessBirthRegion("   ").region).toBeNull();
  });

  it("drops to low confidence for a province that is not the country", () => {
    // "London, Ontario, USA" is a real kind of data-entry error, and "Ontario,
    // California" is a real place.
    const guess = guessBirthRegion("Ontario, California, USA");
    expect(guess.region).toBe("canada");
    expect(guess.confidence).toBe("low");
  });

  it("explains itself in every case, so the guess can be argued with", () => {
    for (const text of [
      "Toronto, Ontario, Canada",
      "St John's, Newfoundland",
      "York, Upper Canada",
      "Port Royal, Acadia",
      "Manchester, England",
      "",
    ]) {
      expect(guessBirthRegion(text).reason.length, text).toBeGreaterThan(20);
    }
  });
});
