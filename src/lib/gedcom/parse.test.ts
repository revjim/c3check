import { describe, expect, it } from "vitest";
import {
  MAX_INDIVIDUALS,
  birthDateOf,
  birthPlaceOf,
  isProbablyLiving,
  parentsOf,
  parseGedcom,
} from "@/lib/gedcom/parse";
import { tokenizeGedcom } from "@/lib/gedcom/tokenize";
import {
  PRIVATE_MARKERS,
  awkwardGedcom,
  baptismOnlyGedcom,
  privateGedcom,
  sevenPointZeroGedcom,
  simpleGedcom,
} from "@/lib/gedcom/fixtures";

describe("tokenizeGedcom", () => {
  it("reads a plain file", () => {
    const { lines, warnings } = tokenizeGedcom(simpleGedcom);
    expect(warnings).toEqual([]);
    expect(lines[0]).toEqual({
      level: 0,
      xref: null,
      tag: "HEAD",
      value: "",
      lineNumber: 1,
    });
    expect(lines.find((l) => l.tag === "INDI")?.xref).toBe("@I1@");
  });

  it("survives a byte-order mark, CRLF endings and indented lines", () => {
    // All three are common in real exports, and any one of them is enough to
    // make a naive parser return nothing at all.
    const { lines, warnings } = tokenizeGedcom(awkwardGedcom);
    expect(warnings).toEqual([]);
    expect(lines[0].tag).toBe("HEAD");
    expect(lines[0].level).toBe(0);
    expect(lines.find((l) => l.tag === "PLAC")?.value).toBe(
      "Sudbury, Ontario, Canada",
    );
  });

  it("survives bare carriage returns", () => {
    const { lines } = tokenizeGedcom("0 HEAD\r1 GEDC\r2 VERS 5.5.1\r0 TRLR");
    expect(lines.map((l) => l.tag)).toEqual(["HEAD", "GEDC", "VERS", "TRLR"]);
  });

  it("joins CONC without a space and CONT with a new line", () => {
    const { lines } = tokenizeGedcom(
      ["0 @I1@ INDI", "1 NAME Alic", "2 CONC e /Fictional/", "2 CONT junior"].join(
        "\n",
      ),
    );
    expect(lines[1].value).toBe("Alice /Fictional/\njunior");
  });

  it("counts a malformed line and carries on rather than throwing", () => {
    // A GEDCOM must not be able to crash the page.
    const { lines, warnings } = tokenizeGedcom(
      ["0 HEAD", "this is not gedcom at all", "0 TRLR"].join("\n"),
    );
    expect(lines.map((l) => l.tag)).toEqual(["HEAD", "TRLR"]);
    expect(warnings[0]).toContain("1 line could not be read");
    expect(warnings[0]).toContain("line 2");
  });

  it("says so when a file is not GEDCOM at all", () => {
    const { lines, warnings } = tokenizeGedcom("just some prose");
    expect(lines).toEqual([]);
    expect(warnings).toContain("Nothing in this file looks like GEDCOM.");
  });

  it("unescapes a doubled at sign in a value", () => {
    const { lines } = tokenizeGedcom("0 @I1@ INDI\n1 NAME a@@b");
    expect(lines[1].value).toBe("a@b");
  });
});

describe("parseGedcom", () => {
  it("reads people, families and the version", () => {
    const file = parseGedcom(simpleGedcom);
    expect(file.version).toBe("5.5.1");
    expect(file.individuals.size).toBe(4);
    expect(file.families.size).toBe(2);
    expect(file.individuals.get("@I1@")?.name).toBe("Alice Fictional");
    expect(file.individuals.get("@I3@")?.sex).toBe("M");
    expect(file.families.get("@F2@")?.children).toEqual(["@I2@"]);
  });

  it("parses 5.5.1 and 7.0 to the same model", () => {
    const older = parseGedcom(simpleGedcom);
    const newer = parseGedcom(sevenPointZeroGedcom);
    for (const xref of ["@I1@", "@I2@", "@I3@"]) {
      const a = older.individuals.get(xref);
      const b = newer.individuals.get(xref);
      expect(b?.name, xref).toBe(a?.name);
      expect(b?.sex, xref).toBe(a?.sex);
      expect(b?.birth, xref).toEqual(a?.birth);
      expect(b?.death, xref).toEqual(a?.death);
      expect(b?.childOf, xref).toEqual(a?.childOf);
    }
    expect(newer.version).toBe("7.0");
  });

  it("keeps nothing but the tags it declares", () => {
    // The privacy decision this parser exists for. A family tree carries
    // notes, sources, photographs, addresses and causes of death about living
    // people who have agreed to nothing, and the safest place for all of it is
    // nowhere.
    const file = parseGedcom(privateGedcom);
    const serialised = JSON.stringify({
      individuals: [...file.individuals.values()],
      families: [...file.families.values()],
      version: file.version,
      warnings: file.warnings,
    });
    for (const marker of PRIVATE_MARKERS) {
      expect(serialised.includes(marker), marker).toBe(false);
    }
    // The things it does keep are still there.
    expect(serialised).toContain("Alice Fictional");
    expect(serialised).toContain("Toronto, Ontario, Canada");
  });

  it("keeps a baptism apart from a birth", () => {
    // A baptism years after a birth can land on the wrong side of 1 January
    // 1947, so the two must never be silently merged.
    const file = parseGedcom(baptismOnlyGedcom);
    const person = file.individuals.get("@I1@");
    expect(person?.birth).toBeNull();
    expect(person?.baptism?.date?.kind).toBe("exact");
    expect(birthDateOf(person!)).toEqual({
      date: person!.baptism!.date,
      from: "baptism",
    });
    expect(birthPlaceOf(person!)?.from).toBe("baptism");
  });

  it("prefers a birth over a baptism when it has both", () => {
    const file = parseGedcom(
      [
        "0 @I1@ INDI",
        "1 BIRT",
        "2 DATE 1 JAN 1900",
        "1 CHR",
        "2 DATE 1 JUN 1900",
      ].join("\n"),
    );
    expect(birthDateOf(file.individuals.get("@I1@")!)?.from).toBe("birth");
  });

  it("returns an empty file rather than throwing on rubbish", () => {
    const file = parseGedcom("this is a PDF, honestly");
    expect(file.individuals.size).toBe(0);
    expect(file.families.size).toBe(0);
    expect(file.warnings.length).toBeGreaterThan(0);
  });

  it("builds a name from GIVN and SURN when there is no NAME value", () => {
    const file = parseGedcom(
      ["0 @I1@ INDI", "1 NAME", "2 GIVN Alice", "2 SURN Fictional"].join("\n"),
    );
    expect(file.individuals.get("@I1@")?.name).toBe("Alice Fictional");
  });

  it("refuses to hold more people than it says it will", () => {
    const many = [
      "0 HEAD",
      ...Array.from({ length: 20 }, (_, i) => `0 @I${i}@ INDI\n1 NAME P${i} //`),
    ].join("\n");
    // The cap itself is far above anything a test can build, so this checks the
    // constant is real and that a small file is nowhere near it.
    expect(MAX_INDIVIDUALS).toBe(100_000);
    expect(parseGedcom(many).individuals.size).toBe(20);
  });
});

describe("reading around the tree", () => {
  it("finds both parents through the family a person is a child in", () => {
    const file = parseGedcom(simpleGedcom);
    expect(parentsOf(file, "@I2@")).toEqual([
      { father: "@I3@", mother: "@I4@" },
    ]);
    expect(parentsOf(file, "@I1@")).toEqual([
      { father: null, mother: "@I2@" },
    ]);
  });

  it("returns nothing for somebody who is not in the file", () => {
    expect(parentsOf(parseGedcom(simpleGedcom), "@NOBODY@")).toEqual([]);
  });
});

describe("isProbablyLiving", () => {
  const file = parseGedcom(simpleGedcom);

  it("takes the reference year as an argument rather than reading a clock", () => {
    // So the person picker can show "living" instead of a birth date without
    // this module ever touching Date.
    expect(isProbablyLiving(file.individuals.get("@I1@")!, 2026)).toBe(true);
    expect(isProbablyLiving(file.individuals.get("@I1@")!, 2200)).toBe(false);
  });

  it("treats a recorded death as settling it", () => {
    expect(isProbablyLiving(file.individuals.get("@I3@")!, 2026)).toBe(false);
  });

  it("assumes living where there is no date to go on", () => {
    const unknown = parseGedcom("0 @I9@ INDI\n1 NAME Nobody //");
    expect(isProbablyLiving(unknown.individuals.get("@I9@")!, 2026)).toBe(true);
  });
});
