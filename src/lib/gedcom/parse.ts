/**
 * A GEDCOM file, reduced to the handful of things a citizenship line needs.
 *
 * **Only the tags listed in `KEPT` are read. Everything else is dropped at parse
 * time and never enters memory.** That is a privacy decision rather than an
 * optimisation, and it is the reason this parser is written rather than taken
 * off the shelf. A family tree carries notes, sources, photographs, addresses,
 * causes of death and medical facts about living people who have agreed to
 * nothing, and the safest place for all of it is nowhere. The parsed file lives
 * in React state, is never written to storage, and holds names, sexes, dates,
 * places and parent links. Nothing else, and there is a test that says so.
 *
 * `CHR` and `BAPM` are read as a **fallback** for a birth date, because for
 * pre-1900 lines a baptism is very often the only record there is. They are kept
 * separately and labelled as baptisms in the interface, never silently merged: a
 * baptism years after a birth can land on the wrong side of 1 January 1947.
 */

import { parseGedcomDate } from "./dates";
import type { GedcomDate } from "./dates";
import { tokenizeGedcom } from "./tokenize";
import type { GedcomLine } from "./tokenize";

/**
 * Every tag this parser reads. Adding one is a privacy decision, not a feature
 * decision, and `parse.test.ts` asserts that nothing outside this set survives.
 */
export const KEPT = [
  "HEAD",
  "GEDC",
  "VERS",
  "INDI",
  "NAME",
  "GIVN",
  "SURN",
  "SEX",
  "BIRT",
  "CHR",
  "BAPM",
  "DEAT",
  "BURI",
  "FAM",
  "HUSB",
  "WIFE",
  "CHIL",
  "FAMC",
  "FAMS",
  "DATE",
  "PLAC",
] as const;

const KEPT_SET = new Set<string>(KEPT);

/** A dated event, with the place as it was typed. */
export type GedcomEvent = {
  date: GedcomDate | null;
  place: string | null;
};

export type GedcomIndividual = {
  xref: string;
  /** The `NAME` value with its slashes removed, or built from GIVN and SURN. */
  name: string | null;
  sex: "M" | "F" | null;
  birth: GedcomEvent | null;
  /** A christening or baptism, kept apart from a birth on purpose. */
  baptism: GedcomEvent | null;
  death: GedcomEvent | null;
  burial: GedcomEvent | null;
  /** The families this person is a child in. Usually one; sometimes more. */
  childOf: string[];
};

export type GedcomFamily = {
  xref: string;
  husband: string | null;
  wife: string | null;
  children: string[];
};

export type GedcomFile = {
  version: string | null;
  individuals: Map<string, GedcomIndividual>;
  families: Map<string, GedcomFamily>;
  warnings: string[];
};

/** Refused before `.text()` is ever called on the file. See `readGedcomFile`. */
export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_INDIVIDUALS = 100_000;
export const WARN_INDIVIDUALS = 20_000;

export function parseGedcom(text: string): GedcomFile {
  const { lines, warnings } = tokenizeGedcom(text);

  const individuals = new Map<string, GedcomIndividual>();
  const families = new Map<string, GedcomFamily>();
  let version: string | null = null;
  let truncated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.level !== 0) continue;

    const record = recordAt(lines, i);

    if (line.tag === "HEAD") {
      version = versionOf(record) ?? version;
      continue;
    }
    if (line.tag === "INDI" && line.xref !== null) {
      if (individuals.size >= MAX_INDIVIDUALS) {
        truncated = true;
        continue;
      }
      individuals.set(line.xref, readIndividual(line.xref, record));
      continue;
    }
    if (line.tag === "FAM" && line.xref !== null) {
      families.set(line.xref, readFamily(line.xref, record));
    }
    // Every other level-0 record, SOUR, NOTE, OBJE, REPO, SUBM, is dropped
    // here and never looked at again.
  }

  if (truncated) {
    warnings.push(
      `This file holds more than ${MAX_INDIVIDUALS.toLocaleString("en-CA")} people, so only the first ${MAX_INDIVIDUALS.toLocaleString("en-CA")} were read.`,
    );
  } else if (individuals.size > WARN_INDIVIDUALS) {
    warnings.push(
      `This is a large file: ${individuals.size} people. Searching it may be slow.`,
    );
  }

  return { version, individuals, families, warnings };
}

/** The lines belonging to the level-0 record starting at `start`, excluding it. */
function recordAt(lines: GedcomLine[], start: number): GedcomLine[] {
  const out: GedcomLine[] = [];
  for (let i = start + 1; i < lines.length && lines[i].level > 0; i++) {
    out.push(lines[i]);
  }
  return out;
}

function versionOf(record: GedcomLine[]): string | null {
  // `1 GEDC` / `2 VERS 5.5.1`, or `1 GEDC` / `2 VERS 7.0`. Both shapes are the
  // same three lines; nothing else about the header is read.
  let inGedc = false;
  for (const line of record) {
    if (line.level === 1) inGedc = line.tag === "GEDC";
    if (inGedc && line.level === 2 && line.tag === "VERS" && line.value !== "") {
      return line.value;
    }
  }
  return null;
}

function readIndividual(
  xref: string,
  record: GedcomLine[],
): GedcomIndividual {
  const person: GedcomIndividual = {
    xref,
    name: null,
    sex: null,
    birth: null,
    baptism: null,
    death: null,
    burial: null,
    childOf: [],
  };

  let given: string | null = null;
  let surname: string | null = null;
  let current: keyof GedcomIndividual | null = null;

  for (const line of record) {
    if (line.level === 1) {
      current = null;
      if (!KEPT_SET.has(line.tag)) continue;
      switch (line.tag) {
        case "NAME":
          if (line.value !== "") person.name ??= cleanName(line.value);
          current = "name";
          break;
        case "SEX":
          person.sex = line.value === "M" ? "M" : line.value === "F" ? "F" : null;
          break;
        case "BIRT":
          person.birth ??= { date: null, place: null };
          current = "birth";
          break;
        case "CHR":
        case "BAPM":
          person.baptism ??= { date: null, place: null };
          current = "baptism";
          break;
        case "DEAT":
          person.death ??= { date: null, place: null };
          current = "death";
          break;
        case "BURI":
          person.burial ??= { date: null, place: null };
          current = "burial";
          break;
        case "FAMC":
          if (line.value !== "") person.childOf.push(line.value);
          break;
        default:
          break;
      }
      continue;
    }

    // Level 2 and below, only inside a structure we are already reading.
    if (current === "name" && line.level === 2) {
      if (line.tag === "GIVN") given = line.value || null;
      if (line.tag === "SURN") surname = line.value || null;
      continue;
    }
    if (
      current === "birth" ||
      current === "baptism" ||
      current === "death" ||
      current === "burial"
    ) {
      const event = person[current];
      if (event === null || line.level !== 2) continue;
      if (line.tag === "DATE" && line.value !== "") {
        event.date ??= parseGedcomDate(line.value);
      }
      if (line.tag === "PLAC" && line.value !== "") {
        event.place ??= line.value;
      }
      // A NOTE, SOUR or OBJE under an event falls through here and is dropped.
    }
  }

  if (person.name === null) {
    const built = [given, surname].filter((part) => part !== null).join(" ").trim();
    person.name = built === "" ? null : built;
  }

  return person;
}

function readFamily(xref: string, record: GedcomLine[]): GedcomFamily {
  const family: GedcomFamily = {
    xref,
    husband: null,
    wife: null,
    children: [],
  };
  for (const line of record) {
    if (line.level !== 1 || line.value === "") continue;
    if (line.tag === "HUSB") family.husband ??= line.value;
    if (line.tag === "WIFE") family.wife ??= line.value;
    if (line.tag === "CHIL") family.children.push(line.value);
  }
  return family;
}

/** `John /Smith/` -> `John Smith`. The slashes delimit the surname. */
function cleanName(value: string): string {
  return value.replace(/\//g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Reading around the tree
// ---------------------------------------------------------------------------

/** The best birth date available, saying plainly where it came from. */
export function birthDateOf(person: GedcomIndividual): {
  date: GedcomDate;
  from: "birth" | "baptism";
} | null {
  if (person.birth?.date != null) {
    return { date: person.birth.date, from: "birth" };
  }
  if (person.baptism?.date != null) {
    return { date: person.baptism.date, from: "baptism" };
  }
  return null;
}

/** The same for a place. */
export function birthPlaceOf(person: GedcomIndividual): {
  place: string;
  from: "birth" | "baptism";
} | null {
  if (person.birth?.place != null) {
    return { place: person.birth.place, from: "birth" };
  }
  if (person.baptism?.place != null) {
    return { place: person.baptism.place, from: "baptism" };
  }
  return null;
}

/**
 * Whether somebody is likely to be alive, so a person picker can show "living"
 * instead of a birth date for them.
 *
 * `referenceYear` is an argument rather than a call to the clock, so this stays
 * pure like everything else here; the component passes the current year in.
 */
export function isProbablyLiving(
  person: GedcomIndividual,
  referenceYear: number,
): boolean {
  if (person.death !== null || person.burial !== null) return false;
  const birth = birthDateOf(person);
  if (birth === null || birth.date.kind === "unparsed") return true;
  const year = Number(birth.date.iso.slice(0, 4));
  // A hundred and ten years is the usual genealogical cutoff for presuming
  // death where no record of it exists.
  return referenceYear - year < 110;
}

/** The parents of a person, through every family they are a child in. */
export function parentsOf(
  file: GedcomFile,
  xref: string,
): { father: string | null; mother: string | null }[] {
  const person = file.individuals.get(xref);
  if (person === undefined) return [];
  return person.childOf
    .map((familyXref) => file.families.get(familyXref))
    .filter((family): family is GedcomFamily => family !== undefined)
    .map((family) => ({ father: family.husband, mother: family.wife }));
}
