import { describe, expect, it } from "vitest";
import { classifyChain } from "@/lib/c3/classify";
import { gcmsChain, newfoundlandBeforeUnionChain, withFacts } from "@/lib/c3/fixtures";
import type { Person, Status } from "@/lib/c3/types";

const statusOf = (chain: Person[], id: string): Status => {
  const status = classifyChain(chain).statuses.find((s) => s.personId === id);
  if (status === undefined) throw new Error(`no status for ${id}`);
  return status;
};

const barsCited = (status: Status): string[] =>
  status.trace.filter((t) => t.kind === "barred").map((t) => t.provision);

describe("3(2.1) — declaration of alienage", () => {
  it("shuts off (k) for an anchor who declared alienage", () => {
    const status = statusOf(
      withFacts(gcmsChain, "g0", { declarationOfAlienage: true }),
      "g0",
    );
    expect(status.outcome).toBe("fails");
    expect(barsCited(status)).toContain("3(2.1)(a)");
  });

  it("takes the whole line down with it", () => {
    const barred = withFacts(gcmsChain, "g0", { declarationOfAlienage: true });
    expect(classifyChain(barred).statuses.map((s) => s.outcome)).toEqual(
      Array(5).fill("fails"),
    );
  });

  it("leaves the (m) route open for anyone who did live in Canada", () => {
    // Barring the anchor ends the claim by descent. It does not decide whether
    // someone born before 1947 was an (m) in their own right — so where that
    // branch is open, the engine says so instead of reporting a refusal it
    // cannot support.
    const barred = withFacts(
      withFacts(gcmsChain, "g0", { declarationOfAlienage: true }),
      "g1",
      { livedInCanadaOrNewfoundland: true },
    );
    const g1 = classifyChain(barred).statuses[1];
    expect(g1.outcome).toBe("undetermined");
    expect(g1.missing.map((m) => m.factId)).toContain("britishSubjectOnPivot");
  });

  it("reports closing off (m) and (n) as an assumption, never silently", () => {
    const result = classifyChain(gcmsChain);
    const gate = result.assumptions.find(
      (a) => a.factId === "livedInCanadaOrNewfoundland" && a.personId === "g1",
    );
    expect(gate?.statement).toMatch(/closing off paragraphs \(m\) and \(n\)/);
  });

  it("shuts off (o) for a person who declared alienage themselves", () => {
    const status = statusOf(
      withFacts(gcmsChain, "g1", { declarationOfAlienage: true }),
      "g1",
    );
    expect(status.outcome).toBe("fails");
    expect(barsCited(status)).toContain("3(2.1)(a)");
  });
});

describe("3(2.3) — the Newfoundland bar", () => {
  it("shuts off (l), not (k)", () => {
    const status = statusOf(
      withFacts(newfoundlandBeforeUnionChain, "g0", {
        declarationOfAlienage: true,
      }),
      "g0",
    );
    expect(status.outcome).toBe("fails");
    const nfld = status.trace.find((t) => t.provision === "3(2.3)(a)");
    expect(nfld?.because).toMatch(/paragraph \(l\)/);
    // (l) is shut off by the Newfoundland bar, never by the Canadian one.
    const canada = status.trace.find((t) => t.provision === "3(2.1)(a)");
    expect(canada?.because ?? "").not.toMatch(/\(l\)/);
  });
});

describe("3(2.5) — a grant before C-3, then a renunciation", () => {
  it("shuts off (q)", () => {
    const status = statusOf(
      withFacts(gcmsChain, "g2", {
        citizenshipByGrant: true,
        renouncedCitizenship: true,
      }),
      "g2",
    );
    expect(status.outcome).toBe("fails");
    expect(barsCited(status)).toContain("3(2.5)");
  });

  it("leaves a grant alone where there was no renunciation", () => {
    // An unrenounced grant is a detect-and-stop, not a bar.
    const status = statusOf(
      withFacts(gcmsChain, "g2", { citizenshipByGrant: true }),
      "g2",
    );
    expect(status.outcome).toBe("stopped");
    expect(barsCited(status)).toEqual([]);
  });
});

describe("3(2.2) — the derivative bar", () => {
  // The one that cannot be evaluated without the parent's paragraph: it reaches
  // a (b), (g) or (h) only where the claim rests solely on a (k), (m), (o) or
  // (q) parent.
  const derivative = withFacts(gcmsChain, "g4", {
    citizenshipByGrant: true,
    renouncedCitizenship: true,
  });

  it("bars the (g) whose claim runs solely through a (q) parent", () => {
    const status = statusOf(derivative, "g4");
    expect(status.outcome).toBe("fails");
    expect(barsCited(status)).toContain("3(2.2)");
  });

  it("names the parent's paragraph in the reason, because that is what triggers it", () => {
    const status = statusOf(derivative, "g4");
    const trace = status.trace.find((t) => t.provision === "3(2.2)");
    expect(trace?.because).toMatch(/paragraph \(q\)/);
  });

  it("does not fire 3(2.4), whose parent set is the Newfoundland one", () => {
    expect(barsCited(statusOf(derivative, "g4"))).not.toContain("3(2.4)");
  });

  it("fires 3(2.4) instead where the parent is on the Newfoundland track", () => {
    const chain = [
      ...newfoundlandBeforeUnionChain,
      { id: "g2", label: "G2", birthDate: "1980-05-05", birthRegion: "outside" as const,
        facts: { citizenshipByGrant: true, renouncedCitizenship: true } },
    ];
    const status = statusOf(chain, "g2");
    expect(barsCited(status)).toContain("3(2.4)");
  });
});

describe("bars and the rest of the engine", () => {
  it("does not stop the person being classified — it removes the paragraph", () => {
    // The paragraph still matched; the trace has to show both, or the reason a
    // claim failed is invisible.
    const status = statusOf(
      withFacts(gcmsChain, "g0", { declarationOfAlienage: true }),
      "g0",
    );
    expect(status.trace.some((t) => t.provision === "3(1)(k)" && t.kind === "matched")).toBe(
      true,
    );
    expect(status.paragraph).toBeNull();
  });
});
