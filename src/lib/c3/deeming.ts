/**
 * Subsection 3(7) — when citizenship takes effect.
 *
 * This is the provision that makes the whole chain computable. A paragraph says
 * *whether* someone is a citizen; 3(7) says *from when*. The child's paragraph
 * then depends on the parent's effective date, not on the parent's paragraph
 * alone — which is why a person born abroad in 1942 to a parent deemed a citizen
 * as of 1 January 1947 is not a (g) but a (q): the parent was not yet a citizen
 * at the time of the birth, seven months later though the deeming date is.
 *
 * The map below is complete. Note that **3(7) has no paragraph (i)** — it runs
 * (a) to (h), then (j) to (m). Paragraph (i) was repealed by S.C. 2025, c. 5,
 * s. 1. That is a drafting artefact, not a gap in this table.
 */

import { ACT_1947, NFLD_UNION } from "./dates";
import type { IsoDate } from "./dates";
import type { Paragraph } from "./types";

/** How the effective date is derived for a given paragraph. */
export type EffectiveRule =
  /** From the moment of birth. */
  | { kind: "birth" }
  /** A fixed date, whatever the birth date. */
  | { kind: "fixed"; date: IsoDate }
  /**
   * From the moment the person ceased to be a citizen. v1 detects and stops on
   * every paragraph that uses this, so the date is never computed — the entry
   * exists so the map is complete and the omission is deliberate rather than
   * forgotten.
   */
  | { kind: "ceased-to-be-a-citizen" };

export type DeemingEntry = {
  /** The subparagraph of 3(7) that does the work, or null where none does. */
  provision: string | null;
  effective: EffectiveRule;
  note?: string;
};

export const DEEMING: Record<Paragraph, DeemingEntry> = {
  a: {
    provision: null,
    effective: { kind: "birth" },
    note: "Citizenship by birth in Canada needs no deeming rule — paragraph (a) operates at the moment of birth.",
  },
  b: { provision: "3(7)(h)", effective: { kind: "birth" } },
  c: { provision: "3(7)(a)", effective: { kind: "ceased-to-be-a-citizen" } },
  "c.1": {
    provision: null,
    effective: { kind: "ceased-to-be-a-citizen" },
    note: "A grant under section 5.1 takes effect from the date of the grant, going forward. It is not retroactive and 3(7) does not reach it.",
  },
  d: {
    provision: "3(7)(b)",
    effective: { kind: "ceased-to-be-a-citizen" },
    note: "3(7)(b) reaches only a (d) who lost citizenship by grant and resumed it. An ordinary (d) was simply already a citizen; the effective date is when they became one.",
  },
  e: { provision: null, effective: { kind: "birth" } },
  f: { provision: "3(7)(c), 3(7)(d)", effective: { kind: "ceased-to-be-a-citizen" } },
  g: { provision: "3(7)(e)", effective: { kind: "birth" } },
  h: { provision: "3(7)(e)", effective: { kind: "birth" } },
  i: { provision: "3(7)(f)", effective: { kind: "ceased-to-be-a-citizen" } },
  j: { provision: "3(7)(g)", effective: { kind: "ceased-to-be-a-citizen" } },
  k: { provision: "3(7)(j)", effective: { kind: "fixed", date: ACT_1947 } },
  l: { provision: "3(7)(l)", effective: { kind: "fixed", date: NFLD_UNION } },
  m: { provision: "3(7)(j)", effective: { kind: "fixed", date: ACT_1947 } },
  n: { provision: "3(7)(l)", effective: { kind: "fixed", date: NFLD_UNION } },
  o: { provision: "3(7)(k)", effective: { kind: "fixed", date: ACT_1947 } },
  p: { provision: "3(7)(m)", effective: { kind: "fixed", date: NFLD_UNION } },
  q: { provision: "3(7)(k)", effective: { kind: "fixed", date: ACT_1947 } },
  r: { provision: "3(7)(m)", effective: { kind: "fixed", date: NFLD_UNION } },
};

/**
 * The date citizenship takes effect for a paragraph, given the birth date.
 * Returns null where the rule is `ceased-to-be-a-citizen`, which v1 never
 * computes because every such paragraph is detect-and-stop.
 */
export function effectiveDateFor(
  paragraph: Paragraph,
  birthDate: IsoDate,
): IsoDate | null {
  const rule = DEEMING[paragraph].effective;
  switch (rule.kind) {
    case "birth":
      return birthDate;
    case "fixed":
      return rule.date;
    case "ceased-to-be-a-citizen":
      return null;
  }
}

export function deemingProvisionFor(paragraph: Paragraph): string | null {
  return DEEMING[paragraph].provision;
}
