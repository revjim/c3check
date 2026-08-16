/**
 * Which paragraph wins when several match.
 *
 * Three steps, in this order:
 *
 * 1. **3(6.3)** — a person described in (k), (l), (m) or (n) *and also* in (o),
 *    (p), (q) or (r) "is deemed to be a citizen only under that paragraph (o),
 *    (p), (q) or (r)". Statutory, not a preference.
 * 2. **3(6.4)** — a person described in (b) and also in (f) "is deemed to be a
 *    citizen only under paragraph (1)(f)". Moot in v1, because (f) is
 *    detect-and-stop, but encoded so it is not forgotten. Note that the ATIP
 *    release contradicts itself here — p. 22 says such a person is a citizen
 *    "only under paragraph 3(1)(b)", p. 33 says "only under paragraph 3(1)(f)",
 *    both citing 3(6.4). The statute says (f), so (f) it is.
 * 3. **A documented tie-break order** for anything the Act leaves open.
 *
 * The one tie the statute does not break is **(o) versus (q)**. Someone born
 * abroad before 1947 to a (k) parent matches (o) directly, and also matches (q)
 * through the reading IRCC adopts at ATIP p. 135 — a parent deemed a citizen as
 * of 1 January 1947 under 3(7) counts as one who "became a citizen on that day
 * under the Canadian Citizenship Act". Nothing in the Act chooses between them.
 * The verified GCMS chain in the r/CanadianbyDescent thread runs k → **o** → q →
 * q, so (o) wins. That is empirical, not statutory, which is exactly why it is
 * written down here as a named decision rather than left to array order.
 */

import type { Paragraph, RuleTrace } from "./types";

const SUPERSEDED_BY_6_3: Paragraph[] = ["k", "l", "m", "n"];
const SUPERSEDING_6_3: Paragraph[] = ["o", "p", "q", "r"];

/**
 * The total order used both to pick a winner and to decide whether an
 * unresolved rule could still change the answer. Earlier beats later.
 */
export const TIE_BREAK_ORDER: readonly Paragraph[] = [
  // The four derived pre-union paragraphs, ahead of (k)–(n) by 3(6.3) and ahead
  // of each other by the (o)-over-(q) decision recorded above.
  "o",
  "p",
  "q",
  "r",
  // The four direct pre-union paragraphs.
  "k",
  "l",
  "m",
  "n",
  // The modern paragraphs. These cannot in practice co-occur with each other or
  // with the pre-union set — their date ranges are disjoint — so their relative
  // position is a formality that keeps the order total.
  "a",
  "d",
  "g",
  "b",
  // Paragraphs v1 detects but does not classify. Present so the order stays
  // total if they are ever added.
  "f",
  "h",
  "i",
  "j",
  "c",
  "c.1",
  "e",
];

export function rank(paragraph: Paragraph): number {
  const i = TIE_BREAK_ORDER.indexOf(paragraph);
  return i === -1 ? TIE_BREAK_ORDER.length : i;
}

/** Does `a` beat `b` under the documented order? */
export function outranks(a: Paragraph, b: Paragraph): boolean {
  return rank(a) < rank(b);
}

export type PrecedenceResult = {
  winner: Paragraph | null;
  /** Everything that matched but lost, in order. */
  alternatives: Paragraph[];
  traces: RuleTrace[];
};

export function resolvePrecedence(matches: Paragraph[]): PrecedenceResult {
  const traces: RuleTrace[] = [];
  let live = [...new Set(matches)];

  if (live.length === 0) {
    return { winner: null, alternatives: [], traces };
  }

  // 1. Subsection 3(6.3).
  const superseding = live.filter((p) => SUPERSEDING_6_3.includes(p));
  const superseded = live.filter((p) => SUPERSEDED_BY_6_3.includes(p));
  if (superseding.length > 0 && superseded.length > 0) {
    traces.push({
      provision: "3(6.3)",
      sourceId: "citizenship-act",
      kind: "superseded",
      because: `also described in paragraph ${superseded
        .map((p) => `(${p})`)
        .join(" and ")}, but a person described in both sets "is deemed to be a citizen only under" paragraph ${superseding
        .map((p) => `(${p})`)
        .join(" or ")}`,
    });
    live = live.filter((p) => !SUPERSEDED_BY_6_3.includes(p));
  }

  // 2. Subsection 3(6.4).
  if (live.includes("b") && live.includes("f")) {
    traces.push({
      provision: "3(6.4)",
      sourceId: "citizenship-act",
      kind: "superseded",
      because:
        'also described in paragraph (b), but a person described in both (b) and (f) "is deemed to be a citizen only under paragraph (1)(f)"',
    });
    live = live.filter((p) => p !== "b");
  }

  // 3. The documented tie-break.
  live.sort((a, b) => rank(a) - rank(b));
  const winner = live[0] ?? null;
  const alternatives = live.slice(1);

  if (winner !== null && alternatives.length > 0) {
    traces.push({
      provision: "tie-break",
      // The evidence for this is the GCMS chain in the r/CanadianbyDescent
      // thread, not the ATIP release — cite the thing actually relied on.
      sourceId: "canadianbydescent-gcms-thread",
      kind: "note",
      because: `also described in paragraph ${alternatives
        .map((p) => `(${p})`)
        .join(" and ")}. The Act does not choose between them; this tool takes (${winner}) because the verified GCMS chain released in the r/CanadianbyDescent thread runs k → o → q → q, classifying such a person as an (o).`,
    });
  }

  return { winner, alternatives, traces };
}
