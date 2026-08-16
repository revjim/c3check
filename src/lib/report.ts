/**
 * The result as an artifact: a checklist to work from, and a plain-text version
 * to paste into an email or a cover letter.
 *
 * Deliberately **not** in `src/lib/c3/`. The engine's contract is that it
 * produces no presentation, and it should stay that way: everything here is a
 * choice about how to say something, not about what the Act means.
 *
 * Pure and clock-free, like the engine. "Generated on" arrives through
 * `options.generatedOn` rather than from `Date`, so the same result always
 * serialises to the same string and the tests never have to pin a clock.
 */

import { provisionOf } from "@/lib/c3";
import type {
  Assumption,
  ChainResult,
  MissingFact,
  Status,
} from "@/lib/c3";
import { ACT_AS_OF, sourceById } from "@/lib/sources";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { formatDate, humaniseDates } from "@/lib/format";

// ---------------------------------------------------------------------------
// The documents to go and find
// ---------------------------------------------------------------------------

export type ChecklistGroup = {
  personId: string;
  label: string;
  documents: string[];
};

/**
 * What would settle everything the result could not.
 *
 * The most actionable thing on the page, and the reason somebody prints it. It
 * unions the documents named by every unresolved fact and by every assumption
 * that carries the answer, grouped by person because that is how archives are
 * searched: one person, one set of records, one trip.
 *
 * Deduplicated **within** a person and not across them. Three different facts
 * about one ancestor commonly name the same census return, and listing it three
 * times is noise; two different ancestors needing a death certificate each is
 * two death certificates, and collapsing those would hide half the work.
 */
export function documentChecklist(result: ChainResult): ChecklistGroup[] {
  const groups: ChecklistGroup[] = [];

  for (const status of result.statuses) {
    const documents: string[] = [];
    const seen = new Set<string>();
    const take = (list: string[]) => {
      for (const document of list) {
        if (seen.has(document)) continue;
        seen.add(document);
        documents.push(document);
      }
    };

    for (const missing of result.missing) {
      if (missing.personId === status.personId) take(missing.documents);
    }
    for (const assumption of result.assumptions) {
      if (assumption.personId !== status.personId) continue;
      if (assumption.decisive !== true) continue;
      take(assumption.documents);
    }

    if (documents.length > 0) {
      groups.push({
        personId: status.personId,
        label: status.label,
        documents,
      });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Sorting the assumptions for display
// ---------------------------------------------------------------------------

export type AssumptionGroups = {
  /** Carries the answer, and has not been confirmed. */
  decisive: Assumption[];
  /** Carries the answer, and the user has said to leave it standing. */
  confirmed: Assumption[];
  /** Assumed, but changed nothing. Collapsed on the page. */
  immaterial: Assumption[];
};

export function groupAssumptions(
  result: ChainResult,
  confirmedBy: (personId: string, factId: string) => boolean,
): AssumptionGroups {
  const groups: AssumptionGroups = {
    decisive: [],
    confirmed: [],
    immaterial: [],
  };
  for (const assumption of result.assumptions) {
    if (assumption.decisive !== true) {
      groups.immaterial.push(assumption);
    } else if (
      assumption.factId !== null &&
      confirmedBy(assumption.personId, assumption.factId)
    ) {
      groups.confirmed.push(assumption);
    } else {
      groups.decisive.push(assumption);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

export type ReportOptions = {
  /** "16 August 2026". Passed in so this stays clock-free. */
  generatedOn?: string;
  /** The name the user gave the line. */
  lineName?: string;
  /** Overridable so a test does not have to know the deployed hostname. */
  url?: string;
};

const WIDTH = 76;

/**
 * The whole result as plain text.
 *
 * ASCII only, `->` for arrows, and no tabs anywhere: a tab survives a text
 * editor and mangles in half the mail clients this will be pasted into. Wrapped
 * at 76 columns for the same reason.
 *
 * Nothing here truncates or reformats a `because` string. Those are written to
 * be pasted into a cover letter as they stand, and editing them down here would
 * quietly change what the reasoning says.
 */
export function reportText(
  result: ChainResult,
  options: ReportOptions = {},
): string {
  const out: string[] = [];
  const line = (text = "") => out.push(text);
  const para = (text: string) => {
    // Every sentence that reaches here was written by the engine, so the dates
    // in it are the ISO strings it compares with. See `humaniseDates`.
    for (const wrapped of wrap(humaniseDates(text), WIDTH)) line(wrapped);
  };
  const rule = () => line("=".repeat(WIDTH));
  const heading = (text: string) => {
    line();
    line(text.toUpperCase());
    line("-".repeat(Math.min(text.length, WIDTH)));
    line();
  };

  // --- Heading -------------------------------------------------------------

  rule();
  line(`${SITE_NAME.toUpperCase()}: CITIZENSHIP BY DESCENT, GENERATION BY GENERATION`);
  rule();
  if (options.lineName !== undefined) line(`Line: ${options.lineName}`);
  if (options.generatedOn !== undefined) {
    line(`Worked out on: ${options.generatedOn}`);
  }
  line(`Citizenship Act as amended: ${ACT_AS_OF}`);
  line();
  para(
    "Not legal or immigration advice. This is an educational tool that reads a statute. Only IRCC can decide whether someone is a citizen.",
  );

  // --- Headline ------------------------------------------------------------

  heading("The answer");
  para(result.headline.summary);
  line();
  line(`Verdict: ${verdictWord(result.headline.verdict)}`);
  if (result.headline.paragraph !== null) {
    line(`Paragraph: ${provisionOf(result.headline.paragraph)}`);
  }
  if (result.headline.effectiveDate !== null) {
    line(`Effective: ${formatDate(result.headline.effectiveDate)}`);
  }
  line(`Confidence: ${confidenceWord(result.headline.confidence)}`);

  // --- Stopped -------------------------------------------------------------

  const stop = result.applicant.stopReason;
  if (stop !== null) {
    heading("Why this stops here");
    para(stop.title);
    line();
    para(stop.detail);
    line();
    line(`Provision: ${stop.provision}`);
    para(`Source: ${citationOf(stop.sourceId)}`);
    line();
    para(
      "This tool stops here on purpose rather than guess. That is not a 'no'.",
    );
  }

  // --- Advisories ----------------------------------------------------------

  if (result.advisories.length > 0) {
    heading("What IRCC is doing with files like this");
    for (const advisory of result.advisories) {
      para(advisory.title);
      line();
      para(advisory.detail);
      if (advisory.action !== undefined) {
        line();
        para(`What you can do: ${advisory.action}`);
      }
      if (advisory.orgId !== undefined) {
        line();
        line(`ORG ID: ${advisory.orgId}`);
        para(
          "The first character is a capital letter O, not a zero. The text layer of the released PDF renders it as a zero; the page image does not.",
        );
      }
      line();
      para(`Source: ${citationOf(advisory.sourceId)}`);
      line();
    }
  }

  // --- The line ------------------------------------------------------------

  heading("Generation by generation");
  for (const [index, status] of result.statuses.entries()) {
    if (index > 0) line();
    line(`${index + 1}. ${status.label}`);
    line(
      `   Born ${formatDate(status.birthDate)}${
        status.deathDate === null ? "" : `, died ${formatDate(status.deathDate)}`
      }`,
    );
    line(`   ${outcomeWord(status)}`);
    if (status.paragraph !== null) {
      line(`   Paragraph ${provisionOf(status.paragraph)}`);
    }
    if (status.effectiveDate !== null) {
      line(`   Citizenship effective ${formatDate(status.effectiveDate)}`);
    }
    if (status.deemingProvision !== null) {
      line(`   Effective date set by ${status.deemingProvision}`);
    }
    if (status.remediedBy !== null) {
      line(`   Brought inside section 3(1) by ${amendmentWord(status.remediedBy)}`);
    }
    line(
      `   ${
        status.generationAbroad === 0
          ? "Born in Canada or in pre-union Newfoundland"
          : `Generation ${status.generationAbroad} born outside Canada`
      }`,
    );
    if (status.alternatives.length > 0) {
      line(
        `   Also described by paragraph ${status.alternatives
          .map((p) => `(${p})`)
          .join(", ")}, which lost on precedence`,
      );
    }
    if (status.orgId !== null) {
      line(`   IRCC ORG ID ${status.orgId.id}, "${status.orgId.name}"`);
    }
  }

  // --- Flags ---------------------------------------------------------------

  if (result.flags.length > 0) {
    heading("Where this is uncertain");
    for (const flag of result.flags) {
      para(`* ${flag.title}`);
      para(`  ${flag.detail}`);
      para(`  Source: ${citationOf(flag.sourceId)}`);
      line();
    }
  }

  // --- Assumptions ---------------------------------------------------------

  const decisive = result.assumptions.filter((a) => a.decisive === true);
  const rest = result.assumptions.filter((a) => a.decisive !== true);

  if (decisive.length > 0) {
    heading("Assumptions that carry the answer");
    para(
      "Each of these was assumed rather than established. If any one of them is wrong, the answer above changes.",
    );
    line();
    for (const assumption of decisive) {
      para(`* ${assumption.statement}`);
      para(`  Why it matters: ${assumption.why}`);
      line();
    }
  }

  if (rest.length > 0) {
    heading(`Assumed, but changed nothing (${rest.length})`);
    for (const assumption of rest) {
      para(`* ${assumption.statement}`);
    }
  }

  // --- Still unknown -------------------------------------------------------

  if (result.missing.length > 0) {
    heading("Still unknown");
    for (const missing of result.missing) {
      para(`* ${missing.question}`);
      para(`  Why it matters: ${missing.why}`);
      line();
    }
  }

  // --- Documents -----------------------------------------------------------

  const checklist = documentChecklist(result);
  if (checklist.length > 0) {
    heading("Documents to gather");
    for (const group of checklist) {
      line(`${group.label}`);
      for (const document of group.documents) {
        for (const [i, wrapped] of wrap(document, WIDTH - 4).entries()) {
          line(`  ${i === 0 ? "-" : " "} ${wrapped}`);
        }
      }
      line();
    }
  }

  // --- Reasoning -----------------------------------------------------------

  heading("The reasoning, in full");
  for (const status of result.statuses) {
    line(status.label);
    line("~".repeat(Math.min(status.label.length, WIDTH)));
    for (const trace of status.trace) {
      const marker = traceMarker(trace.kind);
      for (const [i, wrapped] of wrap(
        humaniseDates(`${trace.provision}: ${trace.because}`),
        WIDTH - 6,
      ).entries()) {
        line(`  ${i === 0 ? marker : "  "} ${wrapped}`);
      }
      for (const wrapped of wrap(
        `Source: ${citationOf(trace.sourceId)}`,
        WIDTH - 6,
      )) {
        line(`      ${wrapped}`);
      }
    }
    line();
  }

  // --- Footer --------------------------------------------------------------

  rule();
  para(
    `Worked out by ${SITE_NAME}, ${options.url ?? SITE_URL}, against the Citizenship Act as amended ${ACT_AS_OF}. Free and open source. Not legal or immigration advice, and not written by a lawyer. Verify any result against the primary sources and consult a licensed lawyer or a CICC member before acting on it.`,
  );
  rule();

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * The words the report uses for an outcome.
 *
 * `undetermined` is never "fails" and never any synonym of it. "Not answerable
 * yet" is what the engine actually means, and the distance between the two is
 * the difference between somebody carrying on and somebody giving up.
 */
export function verdictWord(verdict: ChainResult["headline"]["verdict"]): string {
  switch (verdict) {
    case "qualifies":
      return "A paragraph of section 3(1) applies";
    case "fails":
      return "No paragraph of section 3(1) describes this line as entered";
    case "undetermined":
      return "Not answerable yet";
    case "stopped":
      return "This tool stops short of an answer here";
    case "incomplete":
      return "No ancestor to reason from yet";
  }
}

function outcomeWord(status: Status): string {
  switch (status.outcome) {
    case "qualifies":
      return status.paragraph === null
        ? "Already a citizen under the Canadian Citizenship Act then in force"
        : "A citizen by operation of law";
    case "fails":
      return "No paragraph of section 3(1) describes them";
    case "undetermined":
      return "Not answerable yet";
    case "stopped":
      return "This tool stops here";
    case "incomplete":
      return "Nothing to reason from yet";
  }
}

export function confidenceWord(
  confidence: ChainResult["headline"]["confidence"],
): string {
  switch (confidence) {
    case "clear":
      return "nothing flagged, and nothing assumed that could change it";
    case "flagged":
      return "rests on a contested reading or on an assumption; read the flags";
    case "unknown":
      return "no answer without more facts";
  }
}

export function amendmentWord(amendment: NonNullable<Status["remediedBy"]>): string {
  switch (amendment) {
    case "c-3":
      return "Bill C-3 (2025)";
    case "c-24":
      return "Bill C-24 (2015)";
    case "c-37":
      return "Bill C-37 (2009)";
    case "pre-existing":
      return "the Act as it already stood";
  }
}

function traceMarker(kind: ChainResult["statuses"][number]["trace"][number]["kind"]): string {
  switch (kind) {
    case "matched":
      return "->";
    case "barred":
      return "x ";
    case "unknown":
      return "? ";
    case "superseded":
      return "> ";
    case "not-matched":
      return "- ";
    case "note":
      return ". ";
  }
}

function citationOf(sourceId: string): string {
  const source = sourceById(sourceId);
  // catalogue.test.ts already guarantees every cited id resolves, so this is
  // defensive only: a rule added without its source should not crash a report.
  if (source === undefined) return sourceId;
  return `${source.title}, ${source.citation}`;
}

/** Word wrap, deterministic and without regard to any locale. */
export function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------

export type { Assumption, MissingFact };
