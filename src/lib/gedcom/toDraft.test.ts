import { describe, expect, it } from "vitest";
import { isCompleteLine, isCompletePerson } from "@/lib/draft";
import { parseGedcom } from "@/lib/gedcom/parse";
import { ancestralPaths } from "@/lib/gedcom/paths";
import {
  describePreview,
  lineFromPath,
  previewPath,
} from "@/lib/gedcom/toDraft";
import { simpleGedcom, twoLinesGedcom } from "@/lib/gedcom/fixtures";

const file = parseGedcom(simpleGedcom);
const anchored = ancestralPaths(file, "@I1@").find((p) => p.reachesAnchor)!;

describe("lineFromPath", () => {
  it("keeps the engine's order and numbers from the applicant", () => {
    const line = lineFromPath(file, anchored, "l1", "From your file");
    expect(line.people.map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
    expect(line.people[0].gedcom?.xref).toBe("@I3@");
    expect(line.people[2].gedcom?.xref).toBe("@I1@");
    expect(line.nextPersonSeq).toBe(4);
  });

  it("prefills without ever completing", () => {
    // The rule this module exists to enforce. A PLAC is whatever a relative
    // typed decades later, and resolvePlace needs the legal status of a place
    // on the day of the birth, so every identity screen is still visited.
    const line = lineFromPath(file, anchored, "l1", "From your file");
    expect(isCompleteLine(line)).toBe(false);
    for (const person of line.people) {
      expect(person.gedcom?.confirmed, person.id).toBe(false);
      expect(isCompletePerson(person), person.id).toBe(false);
    }
  });

  it("carries the raw place and date text through, so the screen can show it", () => {
    const line = lineFromPath(file, anchored, "l1", "From your file");
    expect(line.people[0].gedcom?.placeText).toBe("Toronto, Ontario, Canada");
    expect(line.people[0].gedcom?.dateText).toBe("2 MAR 1912");
    expect(line.people[0].birthDate).toBe("1912-03-02");
    expect(line.people[0].birthRegion).toBe("canada");
  });

  it("marks an approximate date as approximate", () => {
    // ABT 1915 becoming 1915-01-01 is the highest-consequence failure this
    // tool has, so the flag travels with the value.
    const other = ancestralPaths(file, "@I1@").find(
      (p) => p.steps[0].xref === "@I4@",
    )!;
    const line = lineFromPath(file, other, "l1", "x");
    expect(line.people[0].birthDateApproximate).toBe(true);
    expect(line.people[0].gedcom?.dateText).toBe("ABT 1915");
  });

  it("never reads a missing death record as being alive", () => {
    // "No DEAT tag" means the file does not say, not that they are living.
    const line = lineFromPath(file, anchored, "l1", "x");
    const withDeath = line.people.find((p) => p.gedcom?.xref === "@I3@");
    const without = line.people.find((p) => p.gedcom?.xref === "@I1@");
    expect(withDeath?.living).toBe(false);
    expect(withDeath?.deathDate).toBe("1980-08-14");
    expect(without?.living).toBeNull();
  });

  it("leaves the date blank when the file's date cannot be read", () => {
    const odd = parseGedcom(
      ["0 @I1@ INDI", "1 BIRT", "2 DATE @#DJULIAN@ 1700"].join("\n"),
    );
    const line = lineFromPath(
      odd,
      { steps: [{ xref: "@I1@", via: "self" }], reachesAnchor: false, score: 0, notes: [] },
      "l1",
      "x",
    );
    expect(line.people[0].birthDate).toBe("");
    expect(line.people[0].gedcom?.dateText).toBe("@#DJULIAN@ 1700");
  });

  it("takes a name from the file as the label", () => {
    const line = lineFromPath(file, anchored, "l1", "x");
    expect(line.people[0].label).toBe("Robert Fictional");
  });
});

describe("previewPath", () => {
  it("runs the real engine rather than scoring the statute twice", () => {
    const preview = previewPath(file, anchored);
    expect(preview.kind).toBe("ready");
    // No facts supplied, so the anchor's loss of British subject status is
    // unknown and the honest preview is that it is not answerable yet.
    expect(preview.kind === "ready" && preview.result.headline.verdict).toBe(
      "undetermined",
    );
  });

  it("names who is holding it up when a date cannot be read", () => {
    const partial = parseGedcom(
      [
        "0 @I1@ INDI",
        "1 NAME Alice /Fictional/",
        "1 FAMC @F1@",
        "0 @I2@ INDI",
        "1 NAME Mary /Fictional/",
        "1 BIRT",
        "2 DATE 1 JAN 1940",
        "2 PLAC Toronto, Ontario, Canada",
        "1 FAMS @F1@",
        "0 @F1@ FAM",
        "1 WIFE @I2@",
        "1 CHIL @I1@",
      ].join("\n"),
    );
    const path = ancestralPaths(partial, "@I1@")[0];
    const preview = previewPath(partial, path);
    expect(preview.kind).toBe("blocked");
    expect(preview.kind === "blocked" && preview.missingDates).toEqual([
      "Alice Fictional",
    ]);
  });

  it("reaches an anchor on the longer of two lines", () => {
    const two = parseGedcom(twoLinesGedcom);
    const paths = ancestralPaths(two, "@I1@");
    expect(previewPath(two, paths[0]).kind).toBe("ready");
  });
});

describe("describePreview", () => {
  it("says what is left to answer rather than pretending to an answer", () => {
    const described = describePreview(previewPath(file, anchored));
    expect(described).toContain("reaches an ancestor");
    expect(described).toContain("to answer");
    expect(described.toLowerCase()).not.toContain("fails");
  });

  it("says plainly when a line has no anchor at all", () => {
    const two = parseGedcom(twoLinesGedcom);
    const paths = ancestralPaths(two, "@I1@");
    const rootless = paths.find((p) => !p.reachesAnchor)!;
    expect(describePreview(previewPath(two, rootless))).toContain("no anchor");
  });

  it("names the person a missing date belongs to", () => {
    expect(
      describePreview({ kind: "blocked", missingDates: ["Alice Fictional"] }),
    ).toContain("Alice Fictional");
  });
});
