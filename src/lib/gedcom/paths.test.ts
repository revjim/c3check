import { describe, expect, it } from "vitest";
import { anchorClassOf, ancestralPaths } from "@/lib/gedcom/paths";
import { parseGedcom } from "@/lib/gedcom/parse";
import {
  cyclicGedcom,
  simpleGedcom,
  twoLinesGedcom,
} from "@/lib/gedcom/fixtures";

describe("ancestralPaths", () => {
  it("returns each line anchor first, ready for the engine", () => {
    // Engine order, so a path hands straight to classifyChain with no reversal.
    const file = parseGedcom(simpleGedcom);
    const paths = ancestralPaths(file, "@I1@");
    expect(paths[0].steps[0].xref).toBe("@I3@");
    expect(paths[0].steps[paths[0].steps.length - 1].xref).toBe("@I1@");
  });

  it("splits one line per parent, so every path is a single line of descent", () => {
    const file = parseGedcom(simpleGedcom);
    const paths = ancestralPaths(file, "@I1@");
    // Alice -> Mary, then Mary's father and Mary's mother are two lines.
    expect(paths).toHaveLength(2);
    expect(new Set(paths.map((p) => p.steps[0].xref))).toEqual(
      new Set(["@I3@", "@I4@"]),
    );
  });

  it("records which parent each step went through", () => {
    const file = parseGedcom(simpleGedcom);
    const viaFather = ancestralPaths(file, "@I1@").find(
      (path) => path.steps[0].xref === "@I3@",
    );
    expect(viaFather?.steps.map((s) => s.via)).toEqual([
      "father",
      "mother",
      "self",
    ]);
  });

  it("stops walking at an ancestor whose birthplace looks Canadian", () => {
    const file = parseGedcom(simpleGedcom);
    const paths = ancestralPaths(file, "@I1@");
    const anchored = paths.filter((path) => path.reachesAnchor);
    expect(anchored).toHaveLength(1);
    expect(anchored[0].steps[0].xref).toBe("@I3@");
  });

  it("ranks a confirmed Canadian anchor above a shorter line that reaches nobody", () => {
    // The whole point of the ranking: a longer line that gets somewhere beats a
    // short one that does not.
    const file = parseGedcom(twoLinesGedcom);
    const paths = ancestralPaths(file, "@I1@");
    expect(paths[0].reachesAnchor).toBe(true);
    expect(paths[0].steps[0].xref).toBe("@I4@");
    expect(paths[0].steps.length).toBeGreaterThan(paths[1].steps.length);
  });

  it("explains why a suggestion ranked where it did", () => {
    const file = parseGedcom(twoLinesGedcom);
    const best = ancestralPaths(file, "@I1@")[0];
    expect(best.notes.join(" ")).toContain("Halifax, Nova Scotia, Canada");
  });

  it("does not blow up on a cycle", () => {
    // A file where somebody is recorded as their own grandparent is rare but
    // real, and without the check the walk never returns.
    const file = parseGedcom(cyclicGedcom);
    const paths = ancestralPaths(file, "@I1@");
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(new Set(path.steps.map((s) => s.xref)).size).toBe(
        path.steps.length,
      );
    }
  });

  it("stops at the depth limit rather than walking for ever", () => {
    const file = parseGedcom(twoLinesGedcom);
    const paths = ancestralPaths(file, "@I1@", { maxDepth: 1 });
    for (const path of paths) expect(path.steps.length).toBeLessThanOrEqual(2);
  });

  it("caps how many paths it returns", () => {
    const file = parseGedcom(simpleGedcom);
    expect(ancestralPaths(file, "@I1@", { maxPaths: 1 })).toHaveLength(1);
  });

  it("returns nothing for somebody who is not in the file", () => {
    expect(ancestralPaths(parseGedcom(simpleGedcom), "@NOBODY@")).toEqual([]);
  });

  it("returns the same order every time it is asked", () => {
    // No clock and no randomness anywhere, so a file always suggests the same
    // lines in the same order.
    const file = parseGedcom(twoLinesGedcom);
    const once = ancestralPaths(file, "@I1@").map((p) =>
      p.steps.map((s) => s.xref).join(">"),
    );
    const twice = ancestralPaths(file, "@I1@").map((p) =>
      p.steps.map((s) => s.xref).join(">"),
    );
    expect(twice).toEqual(once);
  });

  it("handles a person with no parents recorded at all", () => {
    const file = parseGedcom(simpleGedcom);
    const paths = ancestralPaths(file, "@I3@");
    expect(paths).toHaveLength(1);
    expect(paths[0].steps).toHaveLength(1);
  });
});

describe("anchorClassOf", () => {
  it("sends a pre-union Newfoundland birth to its own paragraph set", () => {
    // The one place where the date, not the string, decides the answer. Both
    // are anchors, and they are completely different anchors: 1949 and the
    // (l)/(n)/(p)/(r) set on one side, 1947 and (k)/(m)/(o)/(q) on the other.
    expect(anchorClassOf("St John's, Newfoundland", "1930-01-01")).toBe(
      "newfoundland",
    );
    expect(anchorClassOf("St John's, Newfoundland", "1955-01-01")).toBe(
      "canada",
    );
  });

  it("treats Canada as Canada whatever the date", () => {
    expect(anchorClassOf("Toronto, Ontario, Canada", "1870-01-01")).toBe(
      "canada",
    );
  });

  it("says nothing for anywhere else, and for a place it cannot place", () => {
    expect(anchorClassOf("Manchester, England", "1900-01-01")).toBeNull();
    expect(anchorClassOf("Port Royal, Acadia", "1700-01-01")).toBeNull();
  });
});
