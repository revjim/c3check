/**
 * Guessing at a birthplace from a `PLAC` string.
 *
 * Every answer here is a **suggestion for a radio button**, never a decision.
 * The application asks the user regardless, and says why, for three separate
 * reasons that all have to hold at once for a place string to settle anything:
 *
 * 1. `resolvePlace` needs the *legal* status of a place on the day of the birth,
 *    which is a question about law rather than about geography. `dates.ts` in
 *    the engine argues this at length, and it is right: Newfoundland and
 *    Labrador is the Act's one geographic carve-out, and before 1 April 1949 a
 *    birth there was not a birth in Canada at all.
 * 2. Subsection 3(1.01) has to say expressly that "Canada" in paragraphs (k),
 *    (m) and (o) to (r) means Canada as it was immediately before the union.
 *    Parliament needed a provision to settle this. A string match will not.
 * 3. A `PLAC` is whatever a relative typed into a form decades later, from a
 *    memory or a transcription. It carries no authority at all.
 *
 * So the confidences below are about how good a *prompt* this is, not about how
 * likely the answer is to be right.
 */

import type { BirthRegion } from "@/lib/c3";

export type PlaceGuess = {
  region: BirthRegion | null;
  confidence: "high" | "low";
  /** Shown next to the pre-selected radio, so the guess can be argued with. */
  reason: string;
};

/** Provinces and territories, with the abbreviations that turn up in files. */
const PROVINCES = [
  "alberta",
  "british columbia",
  "manitoba",
  "new brunswick",
  "nova scotia",
  "ontario",
  "prince edward island",
  "quebec",
  "saskatchewan",
  "northwest territories",
  "nunavut",
  "yukon",
];

const PROVINCE_CODES = [
  "ab",
  "bc",
  "mb",
  "nb",
  "ns",
  "on",
  "pe",
  "pei",
  "qc",
  "sk",
  "nt",
  "nu",
  "yt",
];

/**
 * Names for the same ground before Confederation. A birth in "Canada West" in
 * 1850 was a birth in what is now Ontario, and `resolvePlace` treats that as
 * Canada, but the string will never say so.
 */
const HISTORICAL: { pattern: RegExp; name: string }[] = [
  { pattern: /\bupper canada\b/, name: "Upper Canada" },
  { pattern: /\blower canada\b/, name: "Lower Canada" },
  { pattern: /\bcanada west\b/, name: "Canada West" },
  { pattern: /\bcanada east\b/, name: "Canada East" },
  { pattern: /\brupert'?s land\b/, name: "Rupert's Land" },
  { pattern: /\bnorth-?west territor/, name: "the North-West Territories" },
];

const NEWFOUNDLAND = /\b(newfoundland|labrador|nfld|nfld\.|nf|nl)\b/;

/**
 * Overlapping with places that are not Canada now. New France reached down the
 * Mississippi and into present-day Louisiana; Acadia covered part of what is
 * now Maine. Neither can be resolved without knowing where in it the birth was.
 */
const AMBIGUOUS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bnew france\b/, name: "New France" },
  { pattern: /\bnouvelle[- ]france\b/, name: "New France" },
  { pattern: /\bacadi[ae]\b/, name: "Acadia" },
];

export function guessBirthRegion(placeText: string): PlaceGuess {
  const text = placeText.toLowerCase().trim();
  if (text === "") {
    return {
      region: null,
      confidence: "low",
      reason: "Your file records no place for this birth.",
    };
  }

  for (const { pattern, name } of AMBIGUOUS) {
    if (pattern.test(text)) {
      return {
        region: null,
        confidence: "low",
        reason: `Your file says ${name}, which covered ground that is now in more than one country. Which side of a modern border a birth there falls on decides the answer, and the place name cannot say.`,
      };
    }
  }

  // Newfoundland before everything else, and always at low confidence. "NL" is
  // also the ISO code for the Netherlands and the postal abbreviation for
  // Newfoundland and Labrador, and in any case the answer turns on the date
  // rather than on the string.
  if (NEWFOUNDLAND.test(text)) {
    return {
      region: "newfoundland",
      confidence: "low",
      reason:
        "Your file mentions Newfoundland or Labrador. Worth checking carefully: a birth there before 1 April 1949 routes to an entirely separate set of paragraphs, and NL is also the country code for the Netherlands.",
    };
  }

  for (const { pattern, name } of HISTORICAL) {
    if (pattern.test(text)) {
      return {
        region: "canada",
        confidence: "low",
        reason: `Your file says ${name}, which is ground that is now in Canada under a name it no longer uses.`,
      };
    }
  }

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const last = parts[parts.length - 1] ?? text;

  if (last === "canada" || /\bcanada$/.test(last)) {
    return {
      region: "canada",
      confidence: "high",
      reason: "Your file gives Canada as the country.",
    };
  }
  if (PROVINCES.includes(last) || PROVINCE_CODES.includes(last)) {
    return {
      region: "canada",
      confidence: "high",
      reason: `Your file ends this place with ${parts[parts.length - 1]}, a Canadian province or territory.`,
    };
  }
  if (PROVINCES.some((province) => text.includes(province))) {
    return {
      region: "canada",
      confidence: "low",
      reason:
        "Your file names a Canadian province somewhere in this place, but not as the country.",
    };
  }
  if (text.includes("canada")) {
    return {
      region: "canada",
      confidence: "low",
      reason: "Your file mentions Canada somewhere in this place.",
    };
  }

  return {
    region: "outside",
    confidence: "low",
    reason:
      "Nothing in this place name points to Canada or to pre-union Newfoundland.",
  };
}
