/**
 * Subsection 3(3): the first-generation limit, as Bill C-3 left it.
 *
 * C-3 did not abolish the limit. It moved it: 3(3) now applies only "to a person
 * born outside Canada **on or after** the day on which An Act to amend the
 * Citizenship Act (2025) comes into force", and where it applies it can be
 * satisfied by 1,095 days of the parent's physical presence in Canada. Everyone
 * born abroad before 15 December 2025 is out of its reach entirely, which is
 * the whole point of the Act.
 *
 * It bites only on paragraph (b). Nothing else in s. 3(1) is subject to it.
 *
 * Subsection 3(5) is an **exception**, not a further bar: Crown service abroad
 * by a parent (3(5)(a)) or by a grandparent at the parent's birth (3(5)(b))
 * removes the physical-presence requirement altogether.
 */

import { CIF, PRESENCE_DAYS, isBefore } from "./dates";
import type { RuleContext } from "./rules";
import type { FactId, Paragraph, RuleTrace, Status } from "./types";

/** The parent paragraphs listed in 3(3)(a)(i)(A). */
const TRIGGER_PARAGRAPHS: Paragraph[] = [
  "b",
  "c.1",
  "e",
  "g",
  "h",
  "i",
  "j",
  "o",
  "p",
  "q",
  "r",
];

export type FglResult = {
  /** True when 3(3) denies paragraph (b) to this person. */
  blocked: boolean;
  traces: RuleTrace[];
  missing: FactId[];
};

export function applyFirstGenerationLimit(ctx: RuleContext): FglResult {
  const traces: RuleTrace[] = [];
  const missing: FactId[] = [];

  if (isBefore(ctx.birthDate, CIF)) {
    traces.push({
      provision: "3(3)",
      sourceId: "bill-c-3",
      kind: "note",
      because: `born before ${CIF}, so the first-generation limit does not apply, subsection 3(3) now reaches only births on or after the day Bill C-3 came into force`,
    });
    return { blocked: false, traces, missing };
  }

  if (!triggers(ctx.parent)) {
    traces.push({
      provision: "3(3)(a)(i)",
      sourceId: "citizenship-act",
      kind: "note",
      because:
        "the citizen parent is not one of the kinds subsection 3(3) lists, a parent who was born in Canada, or who is a citizen under paragraph (a), (d) or (k) to (n), does not trigger the limit",
    });
    return { blocked: false, traces, missing };
  }

  // 3(5). Checked before the day count, because it removes the requirement
  // rather than satisfying it.
  const crownParent = ctx.bool("crownServiceParent");
  const crownGrandparent = ctx.bool("crownServiceGrandparent");
  if (crownParent === true || crownGrandparent === true) {
    traces.push({
      provision: crownParent === true ? "3(5)(a)" : "3(5)(b)",
      sourceId: "citizenship-act",
      kind: "note",
      because: `subsection 3(3) does not apply: ${
        crownParent === true
          ? "a parent was employed outside Canada with the Canadian Armed Forces, the federal public administration or a provincial public service at the time of the birth"
          : "a grandparent was in that service at the time of the parent's birth"
      }. No physical-presence requirement follows.`,
    });
    return { blocked: false, traces, missing };
  }

  const days = ctx.num("presenceDaysInCanada");
  if (days === undefined) {
    missing.push("presenceDaysInCanada");
    traces.push({
      provision: "3(3)(a)(ii)",
      sourceId: "citizenship-act",
      kind: "unknown",
      because: `the citizen parent's total days of physical presence in Canada before this birth are not known, and ${PRESENCE_DAYS} days is the whole test`,
    });
    return { blocked: false, traces, missing };
  }

  if (days >= PRESENCE_DAYS) {
    traces.push({
      provision: "3(3)(a)(ii)",
      sourceId: "citizenship-act",
      kind: "note",
      because: `the citizen parent was physically present in Canada for ${days} days before the birth, meeting the ${PRESENCE_DAYS}-day requirement`,
    });
    return { blocked: false, traces, missing };
  }

  traces.push({
    provision: "3(3)(a)(ii)",
    sourceId: "citizenship-act",
    kind: "barred",
    because: `paragraph (b) does not apply: the citizen parent was physically present in Canada for ${days} days before the birth, short of the ${PRESENCE_DAYS} days subsection 3(3) requires. This tool follows one line of descent, if the *other* parent is also a citizen and meets the ${PRESENCE_DAYS} days, 3(3)(a)(ii) is not satisfied and the limit does not bite.`,
  });
  return { blocked: true, traces, missing };
}

/**
 * Does this parent bring the child within 3(3)?
 *
 * 3(3)(a)(i)(A) lists the paragraphs; 3(3)(b)(i) covers the equivalent
 * descent provisions of the 1946 and 1952 Acts, which this engine represents as
 * a parent who was a citizen from birth abroad under the former Act, a citizen
 * with no paragraph of the current s. 3(1) and an effective date at their birth.
 */
function triggers(parent: Status | null): boolean {
  if (parent === null || parent.outcome !== "qualifies") return false;
  if (parent.generationAbroad < 1) return false;
  if (parent.paragraph === null) {
    // 3(3)(b): a parent who was a citizen by descent under the former Act.
    return parent.remediedBy === "pre-existing";
  }
  return TRIGGER_PARAGRAPHS.includes(parent.paragraph);
}
