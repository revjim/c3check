import { describe, expect, it } from "vitest";
import { SOURCES, SOURCES_BY_KIND } from "@/lib/sources";

describe("sources", () => {
  it("has a unique id for every source", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every source at an https URL", () => {
    for (const s of SOURCES) {
      expect(s.url, s.id).toMatch(/^https:\/\//);
    }
  });

  it("renders every source under exactly one heading", () => {
    // A source whose `kind` is missing from SOURCES_BY_KIND would silently
    // vanish from /sources rather than fail loudly.
    const rendered = SOURCES_BY_KIND.flatMap(({ kind }) =>
      SOURCES.filter((s) => s.kind === kind),
    );
    expect(rendered).toHaveLength(SOURCES.length);
  });

  it("gives every source a citation and a title", () => {
    for (const s of SOURCES) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.citation.length, s.id).toBeGreaterThan(0);
    }
  });
});
