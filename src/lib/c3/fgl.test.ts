import { describe, expect, it } from "vitest";
import { classifyChain } from "@/lib/c3/classify";
import { PRESENCE_DAYS } from "@/lib/c3/dates";
import { gcmsChain, postCifChain } from "@/lib/c3/fixtures";
import type { PersonFacts } from "@/lib/c3/types";

const applicant = (facts: PersonFacts = {}) =>
  classifyChain(postCifChain(facts)).applicant;

describe("3(3) after Bill C-3", () => {
  it("does not touch a birth abroad before the coming into force", () => {
    // The whole point of the Act. Everyone born abroad before 2025-12-15 is out
    // of the limit's reach, however many generations back the anchor is.
    const g4 = classifyChain(gcmsChain).applicant;
    expect(g4.paragraph).toBe("g");
    expect(
      g4.trace.some((t) => t.provision === "3(3)" && t.kind === "barred"),
    ).toBe(false);
  });

  it("does not touch a first-generation birth abroad after it either", () => {
    const chain = [
      { id: "g0", label: "G0", birthDate: "1960-05-04", birthRegion: "canada" as const },
      { id: "g1", label: "G1", birthDate: "2030-04-01", birthRegion: "outside" as const },
    ];
    const result = classifyChain(chain);
    expect(result.applicant.paragraph).toBe("b");
    expect(result.applicant.missing).toEqual([]);
  });
});

describe("the 1,095-day test", () => {
  it("met: the paragraph stands", () => {
    const status = applicant({ presenceDaysInCanada: PRESENCE_DAYS });
    expect(status.outcome).toBe("qualifies");
    expect(status.paragraph).toBe("b");
    expect(status.orgId?.id).toBe("O181367938988");
  });

  it("not met: the paragraph goes, and the trace says by how much", () => {
    const status = applicant({ presenceDaysInCanada: 400 });
    expect(status.outcome).toBe("fails");
    expect(status.paragraph).toBeNull();
    const bar = status.trace.find(
      (t) => t.provision === "3(3)(a)(ii)" && t.kind === "barred",
    );
    expect(bar?.because).toMatch(/400 days/);
  });

  it("not met: says a second citizen parent would change the answer", () => {
    const status = applicant({ presenceDaysInCanada: 400 });
    const bar = status.trace.find((t) => t.kind === "barred");
    expect(bar?.because).toMatch(/other.*parent/i);
  });

  it("unknown: undetermined, naming the fact and the form", () => {
    const status = applicant();
    expect(status.outcome).toBe("undetermined");
    const gap = status.missing.find((m) => m.factId === "presenceDaysInCanada");
    expect(gap).toBeDefined();
    expect(gap?.documents.join(" ")).toMatch(/CIT 0555/);
  });

  it("counts one day short as short", () => {
    expect(applicant({ presenceDaysInCanada: PRESENCE_DAYS - 1 }).outcome).toBe(
      "fails",
    );
    expect(applicant({ presenceDaysInCanada: PRESENCE_DAYS }).outcome).toBe(
      "qualifies",
    );
  });
});

describe("3(5): Crown service", () => {
  it("removes the requirement rather than satisfying it", () => {
    // No day count is supplied at all, and none is needed.
    const status = applicant({ crownServiceParent: true });
    expect(status.outcome).toBe("qualifies");
    expect(status.paragraph).toBe("b");
    expect(status.missing).toEqual([]);
    expect(status.trace.some((t) => t.provision === "3(5)(a)")).toBe(true);
  });

  it("reaches the grandchild of someone in Crown service too", () => {
    const status = applicant({ crownServiceGrandparent: true });
    expect(status.outcome).toBe("qualifies");
    expect(status.trace.some((t) => t.provision === "3(5)(b)")).toBe(true);
  });

  it("overrides a day count that would otherwise fail", () => {
    const status = applicant({
      crownServiceParent: true,
      presenceDaysInCanada: 10,
    });
    expect(status.outcome).toBe("qualifies");
  });
});
