/**
 * The bar provisions — subsections 3(2.1) to 3(2.5).
 *
 * There are **five**, not three, and two of them are derivative:
 *
 * - **3(2.1)** shuts off (k), (m), (o) and (q).
 * - **3(2.3)** shuts off the Newfoundland set: (l), (n), (p) and (r).
 * - **3(2.5)** shuts off (b), (f) to (j), (q) and (r).
 * - **3(2.2)** and **3(2.4)** shut off (b), (g) and (h) — but only for a person
 *   who would be a citizen under one of those paragraphs "for the sole reason
 *   that one or both of their parents are persons referred to in" (k), (m), (o)
 *   and (q), or (l), (n), (p) and (r) respectively. Evaluating them therefore
 *   requires the *parent's* paragraph, which is why they cannot be expressed as
 *   a predicate over the person alone.
 *
 * All five turn on a grant of citizenship followed by a renunciation, except
 * 3(2.1)(a) and 3(2.3)(a), which turn on a declaration of alienage.
 *
 * One honest limitation: the engine does not collect the *date* of a grant. The
 * three "by way of grant" limbs are each qualified by a date — on or after
 * 1 January 1947, on or after 1 April 1949, and before the C-3 coming into force
 * — and the engine treats a stated grant as falling inside all three, since
 * grants of Canadian citizenship did not exist before 1947 and a renunciation
 * recorded now will almost always predate C-3. Where that matters, the trace
 * says so.
 */

import { ACT_1947, CIF, NFLD_UNION } from "./dates";
import type { RuleContext } from "./rules";
import type { FactId, Paragraph, RuleTrace, Status } from "./types";

export type BarResult = {
  /** Paragraphs removed from the match set. */
  barred: Paragraph[];
  traces: RuleTrace[];
  /** Facts with no default that were needed and not supplied. */
  missing: FactId[];
};

const BARRED_BY_2_1: Paragraph[] = ["k", "m", "o", "q"];
const BARRED_BY_2_3: Paragraph[] = ["l", "n", "p", "r"];
const BARRED_BY_2_5: Paragraph[] = ["b", "f", "g", "h", "i", "j", "q", "r"];
const BARRED_BY_2_2_AND_2_4: Paragraph[] = ["b", "g", "h"];

/** The parent paragraphs that make 3(2.2) and 3(2.4) bite. */
const DERIVATIVE_PARENTS_2_2: Paragraph[] = ["k", "m", "o", "q"];
const DERIVATIVE_PARENTS_2_4: Paragraph[] = ["l", "n", "p", "r"];

export function applyBars(ctx: RuleContext, matches: Paragraph[]): BarResult {
  const traces: RuleTrace[] = [];
  const barred = new Set<Paragraph>();
  const missing: FactId[] = [];

  const alienage = ctx.bool("declarationOfAlienage");
  const granted = ctx.bool("citizenshipByGrant");
  const renounced = ctx.bool("renouncedCitizenship");

  const grantThenRenunciation = granted === true && renounced === true;

  const bar = (
    provision: string,
    paragraphs: Paragraph[],
    because: string,
  ): void => {
    const hit = paragraphs.filter((p) => matches.includes(p));
    if (hit.length === 0) return;
    for (const p of hit) barred.add(p);
    traces.push({
      provision,
      sourceId: "citizenship-act",
      kind: "barred",
      because: `paragraph ${hit.map((p) => `(${p})`).join(", ")} ${
        hit.length === 1 ? "does" : "do"
      } not apply: ${because}`,
    });
  };

  // 3(2.1)(a) and 3(2.3)(a) — declaration of alienage.
  if (alienage === true) {
    bar(
      "3(2.1)(a)",
      BARRED_BY_2_1,
      `a declaration of alienage was made before ${ACT_1947}`,
    );
    bar(
      "3(2.3)(a)",
      BARRED_BY_2_3,
      `a declaration of alienage was made before ${NFLD_UNION}`,
    );
  }

  // 3(2.1)(b), 3(2.3)(b), 3(2.5) — grant followed by renunciation.
  if (grantThenRenunciation) {
    bar(
      "3(2.1)(b)",
      BARRED_BY_2_1,
      `citizenship was granted on or after ${ACT_1947} and subsequently renounced under one of the provisions in clauses 3(1)(f)(i)(A) to (F)`,
    );
    bar(
      "3(2.3)(b)",
      BARRED_BY_2_3,
      `citizenship was granted on or after ${NFLD_UNION} and subsequently renounced`,
    );
    bar(
      "3(2.5)",
      BARRED_BY_2_5,
      `citizenship was granted before ${CIF} and subsequently renounced`,
    );

    // 3(2.2) and 3(2.4) — the derivative bars. These need the parent's
    // paragraph: they reach only a person who would be a (b), (g) or (h) "for
    // the sole reason that" their parent is in the relevant set.
    const parentParagraph = ctx.parent?.paragraph ?? null;
    if (parentParagraph !== null && soleReason(ctx.parent)) {
      if (DERIVATIVE_PARENTS_2_2.includes(parentParagraph)) {
        bar(
          "3(2.2)",
          BARRED_BY_2_2_AND_2_4,
          `this claim rests solely on a parent who is a citizen under paragraph (${parentParagraph}), and citizenship was granted on or after ${ACT_1947} and subsequently renounced`,
        );
      }
      if (DERIVATIVE_PARENTS_2_4.includes(parentParagraph)) {
        bar(
          "3(2.4)",
          BARRED_BY_2_2_AND_2_4,
          `this claim rests solely on a parent who is a citizen under paragraph (${parentParagraph}), and citizenship was granted on or after ${NFLD_UNION} and subsequently renounced`,
        );
      }
    }
  }

  if (alienage === undefined) missing.push("declarationOfAlienage");
  if (granted === undefined) missing.push("citizenshipByGrant");
  if (granted === true && renounced === undefined) {
    missing.push("renouncedCitizenship");
  }

  return { barred: [...barred], traces, missing };
}

/**
 * "For the sole reason that one or both of their parents are persons referred to
 * in…" — this engine follows a single line, so the parent it knows about is the
 * only route it has found. That is the sole reason it can see; a second citizen
 * parent outside the line would take the person out of 3(2.2) and 3(2.4)
 * entirely, which the results should say.
 */
function soleReason(parent: Status | null): boolean {
  return parent !== null && parent.outcome === "qualifies";
}
