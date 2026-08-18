/**
 * The result as a file: markdown out, and the same markdown back in.
 *
 * A sibling of `report.ts` rather than more of it. That module writes plain text
 * for pasting into an email, wrapped at 76 columns and citation-only; this one
 * writes a document to keep, with real links, a table, and the interview itself
 * embedded in a fenced block so the file can be read back. They share every
 * judgment about *what* to say, through `chainRows`, `documentChecklist` and
 * `groupAssumptions`, and disagree only about form.
 *
 * Pure and clock-free, like the engine and like `report.ts`. "Worked out on"
 * arrives through `options.generatedOn`, so the same result always serialises to
 * the same bytes and the tests never have to pin a clock.
 *
 * Three things this file is careful about, each of which broke something once:
 *
 * - **Pipes.** A user-typed label goes straight into a markdown table, and one
 *   apostrophe-laden name with a pipe in it silently destroys the row.
 * - **Fences.** The state block is JSON containing user text, and user text can
 *   contain three backticks. The fence is therefore as long as it needs to be.
 * - **The state block is authoritative.** Everything above it is prose written
 *   for a person; the block is the interview. An import reads only the block, and
 *   validates it through the same `migrateLine` that storage goes through.
 */

import { provisionOf, ruleTitleFor } from "@/lib/c3";
import type { ChainResult, Paragraph, Status } from "@/lib/c3";
import { DRAFT_VERSION, migrateLine } from "@/lib/draft";
import type { LineDraft } from "@/lib/draft";
import { formatDate, humaniseDates, plural } from "@/lib/format";
import {
  amendmentWord,
  chainRows,
  confidenceWord,
  descendantNote,
  documentChecklist,
  verdictWord,
} from "@/lib/report";
import { ACT_AS_OF, SOURCES, sourceById } from "@/lib/sources";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// ---------------------------------------------------------------------------
// The state block
// ---------------------------------------------------------------------------

/**
 * The heading the machine-readable block lives under.
 *
 * **Stable, and load-bearing in two places.** `parseLineDocument` finds the block
 * by looking for this string, and the import screen decides whether a file is a
 * c3check document or a GEDCOM by sniffing for it rather than by trusting the
 * extension. Changing it orphans every file anyone has already downloaded.
 */
export const STATE_HEADING = "## c3check state";

/**
 * The envelope version, separate from `DRAFT_VERSION`.
 *
 * The draft version describes the shape of a `LineDraft`, which `migrateLine`
 * already upgrades. This describes the shape of the wrapper around it, and exists
 * so that a future change to the envelope, a second line in one file, say, can be
 * told apart from a stale draft inside the current envelope.
 */
export const STATE_FORMAT = 1;

export type LineDocument = {
  format: number;
  draftVersion: number;
  line: LineDraft;
};

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type MarkdownOptions = {
  /** "16 August 2026". Passed in so this stays clock-free. */
  generatedOn?: string;
  /**
   * The interview behind the result. Without it the document is still complete
   * prose, and simply carries no state block, so it cannot be read back.
   */
  line?: LineDraft;
  /** The name of the line, where there is no `line` to take it from. */
  lineName?: string;
  /** Overridable so a test does not have to know the deployed hostname. */
  url?: string;
};

export function reportMarkdown(
  result: ChainResult,
  options: MarkdownOptions = {},
): string {
  const out: string[] = [];
  const line = (text = "") => out.push(text);
  // Every sentence the engine writes contains the ISO dates it compares with, so
  // "effective 1970-08-08" would sit under a field reading "8 August 1970".
  const para = (text: string) => {
    line(humaniseDates(text));
    line();
  };
  const heading = (level: number, text: string) => {
    line();
    line(`${"#".repeat(level)} ${text}`);
    line();
  };
  const bullet = (text: string) => line(`- ${humaniseDates(text)}`);

  const lineName = options.lineName ?? options.line?.name;
  const url = options.url ?? SITE_URL;

  // --- Front matter --------------------------------------------------------

  line(`# ${SITE_NAME}: ${lineName ?? "a family line"}`);
  line();
  para(
    "Which paragraph of section 3 of the Citizenship Act applies to each generation of one family line, and what the answer rests on.",
  );
  if (lineName !== undefined) bullet(`Line: ${lineName}`);
  if (options.generatedOn !== undefined) {
    bullet(`Worked out on: ${options.generatedOn}`);
  }
  bullet(`Citizenship Act as amended: ${ACT_AS_OF}`);
  bullet(`Worked out by ${SITE_NAME}, ${url}`);
  line();
  para(
    "**Not legal or immigration advice**, and not written by a lawyer. This is an educational tool that reads a statute. Only IRCC can decide whether someone is a citizen. Verify any of this against the sources listed at the end and consult a licensed lawyer or a CICC member before acting on it.",
  );
  para(
    "**This file contains personal information about living people**: names, birth dates, places of birth and dates of death, for you and for your relatives, none of whom agreed to anything. It was written on your own device and nothing was uploaded to produce it. Where it goes next is entirely up to you, and it goes wherever you send it.",
  );

  // --- The answer ----------------------------------------------------------

  heading(2, "The answer");
  para(result.headline.summary);
  bullet(`Verdict: ${verdictWord(result.headline.verdict)}`);
  if (result.headline.paragraph !== null) {
    bullet(`Paragraph: ${provisionOf(result.headline.paragraph)}`);
  }
  if (result.headline.effectiveDate !== null) {
    bullet(`Effective: ${formatDate(result.headline.effectiveDate)}`);
  }
  bullet(`About: ${result.applicant.label}`);
  bullet(`Confidence: ${confidenceWord(result.headline.confidence)}`);

  const descendants = descendantNote(result);
  if (descendants !== null) {
    line();
    para(
      `${descendants} The answer above is about ${result.applicant.label}; the chain below gives every generation its own paragraph and effective date.`,
    );
  }

  // --- Stopped -------------------------------------------------------------

  const stop = result.applicant.stopReason;
  if (stop !== null) {
    heading(2, "Why this stops here");
    para(`**${stop.title}**`);
    para(stop.detail);
    bullet(`Provision: ${stop.provision}`);
    bullet(`Source: ${sourceLink(stop.sourceId)}`);
    line();
    para(
      "This tool stops here on purpose rather than guess. That is not a 'no'. It means the situation runs on rules this version does not model, and a wrong answer would be worse than none.",
    );
  }

  // --- Advisories ----------------------------------------------------------

  if (result.advisories.length > 0) {
    heading(2, "What IRCC is doing with files like this");
    para(
      "Separate from the classification, and not folded into it. The Act says one thing; the department's current operating instructions say another.",
    );
    for (const advisory of result.advisories) {
      heading(3, advisory.title);
      para(advisory.detail);
      if (advisory.action !== undefined) {
        para(`**What you can do.** ${advisory.action}`);
      }
      if (advisory.orgId !== undefined) {
        bullet(`ORG ID: ${advisory.orgId}`);
        bullet(
          "The first character is a capital letter O, not a zero. The text layer of the released PDF renders it as a zero; the page image does not.",
        );
      }
      bullet(`Source: ${sourceLink(advisory.sourceId)}`);
      line();
    }
  }

  // --- The chain -----------------------------------------------------------

  heading(2, "The full chain as an officer will write it up");
  para(
    "One row per generation, earliest first. G0 is the earliest generation in the line.",
  );
  line("| Person | Paragraph | Citizen as of | Why |");
  line("| --- | --- | --- | --- |");
  for (const row of chainRows(result)) {
    const person = row.isApplicant ? `${row.person}, you` : row.person;
    const why = row.note === null ? row.why : `${row.why} (${row.note})`;
    line(
      `| ${cell(person)} | ${cell(row.paragraph)} | ${cell(row.citizenAsOf)} | ${cell(why)} |`,
    );
  }
  line();

  // --- Generation by generation -------------------------------------------

  heading(2, "Generation by generation");
  para(
    "IRCC classifies every generation in a line under its own paragraph, not only the applicant, and each generation's answer depends on the one before it.",
  );
  for (const [index, status] of result.statuses.entries()) {
    heading(3, `G${index}: ${status.label}`);
    bullet(
      `Born ${formatDate(status.birthDate)}${
        status.deathDate === null ? "" : `, died ${formatDate(status.deathDate)}`
      }`,
    );
    bullet(outcomeLine(status));
    if (status.paragraph !== null) {
      bullet(`Paragraph ${provisionOf(status.paragraph)}`);
    }
    if (status.effectiveDate !== null) {
      bullet(
        `Citizenship effective ${formatDate(status.effectiveDate)}${
          status.deemingProvision === null
            ? ""
            : `, by subsection ${status.deemingProvision}, which is what sets the date rather than the birth`
        }`,
      );
    }
    if (status.remediedBy !== null) {
      bullet(
        `Brought inside section 3(1) by ${amendmentWord(status.remediedBy)}`,
      );
    }
    bullet(
      status.generationAbroad === 0
        ? "Born in Canada, or in Newfoundland and Labrador before it joined Confederation. This is the anchor the rest of the line reasons from."
        : `${plural(status.generationAbroad, "generation", "generations")} born outside Canada.`,
    );
    if (status.alternatives.length > 0) {
      bullet(
        `Also described by paragraph ${status.alternatives
          .map((paragraph) => provisionOf(paragraph))
          .join(" and ")}, which lost on precedence under subsections 3(6.3) and 3(6.4).`,
      );
    }
    if (status.orgId !== null) {
      bullet(`IRCC processing category ${status.orgId.id}, ${status.orgId.name}`);
      for (const criterion of status.orgId.criteria) {
        line(`  - ${humaniseDates(criterion)}`);
      }
    }
    if (status.stopReason !== null) {
      line();
      para(`**${status.stopReason.title}.** ${status.stopReason.detail}`);
    }
    line();
  }

  // --- Flags ---------------------------------------------------------------

  if (result.flags.length > 0) {
    heading(2, "Where this is uncertain");
    para(
      "Each of these is a point where the sources are contested, withheld, or silent. The classification follows the statute; these say where somebody applying it might not.",
    );
    for (const flag of result.flags) {
      heading(3, flag.title);
      para(flag.detail);
      bullet(`Source: ${sourceLink(flag.sourceId)}`);
      line();
    }
  }

  // --- Assumptions ---------------------------------------------------------

  const decisive = result.assumptions.filter((a) => a.decisive === true);
  const rest = result.assumptions.filter((a) => a.decisive !== true);

  if (decisive.length > 0) {
    heading(2, "What this rests on");
    para(
      "Each of these was assumed rather than established, and each one changes the answer if it is wrong.",
    );
    for (const assumption of decisive) {
      bullet(`**${assumption.statement}** ${assumption.why}`);
      for (const document of assumption.documents) {
        line(`  - Would settle it: ${document}`);
      }
    }
    line();
  }

  if (rest.length > 0) {
    heading(2, `Assumed, but changed nothing (${rest.length})`);
    for (const assumption of rest) bullet(assumption.statement);
    line();
  }

  // --- Still unknown -------------------------------------------------------

  if (result.missing.length > 0) {
    heading(2, "Still unknown");
    para(
      "These have no safe default, so the tool declines to guess at them. Until one is settled, the generation it belongs to is not answerable rather than answered either way.",
    );
    for (const missing of result.missing) {
      bullet(`**${missing.question}** ${missing.why}`);
      for (const document of missing.documents) {
        line(`  - Would settle it: ${document}`);
      }
    }
    line();
  }

  // --- Documents -----------------------------------------------------------

  const checklist = documentChecklist(result);
  if (checklist.length > 0) {
    heading(2, "Documents to gather");
    para(
      "Everything above that is assumed or unknown, turned into things to go and find, grouped by the person whose records they are. These are suggestions for someone working on their own, not a checklist IRCC publishes.",
    );
    for (const group of checklist) {
      heading(3, group.label);
      for (const document of group.documents) bullet(`[ ] ${document}`);
      line();
    }
  }

  // --- Reasoning -----------------------------------------------------------

  heading(2, "The reasoning, in full");
  para(
    "Every provision that was checked against every generation, and what it decided. Each line is written to be readable on its own, and to be quoted as it stands.",
  );
  for (const status of result.statuses) {
    heading(3, status.label);
    for (const trace of status.trace) {
      bullet(
        `${traceWord(trace.kind)} \`${trace.provision}\`: ${trace.because}`,
      );
      line(`  - ${sourceLink(trace.sourceId)}`);
    }
    line();
  }

  // --- Sources -------------------------------------------------------------

  heading(2, "Sources");
  para(
    "Every provision cited above, and where to read it. These are the primary sources this tool was built from; the reasoning is only worth what they say.",
  );
  for (const source of sourcesUsed(result)) {
    bullet(`[${source.title}, ${source.citation}](${source.url})`);
    if (source.note !== undefined) line(`  - ${humaniseDates(source.note)}`);
  }
  line();

  // --- Notes for an assistant ---------------------------------------------

  heading(2, "Notes for an assistant");
  para(
    `If this file has been handed to a language model, or to anybody picking it up cold, this section is the briefing. ${SITE_NAME} (${url}) is a free, open-source tool that reads section 3 of Canada's Citizenship Act and works out which paragraph applies to each generation of one family line. It is not a lawyer and it is not IRCC.`,
  );
  para(
    "**What the Act does.** Section 3(1) lists the paragraphs under which a person is a citizen by operation of law, retroactively, as opposed to by a grant. Which paragraph applies to a person depends on where and when they were born and on the paragraph that applied to their parent, so a line is a chain and each link depends on the one before it. Bill C-3 (S.C. 2025, c. 5) removed the first-generation limit for everyone born abroad before it came into force on 15 December 2025 and replaced it, going forward, with a test of the citizen parent's physical presence in Canada.",
  );
  const paragraphs = paragraphsInPlay(result);
  if (paragraphs.length > 0) {
    para("**The paragraphs in play in this line**, as they read:");
    for (const paragraph of paragraphs) {
      bullet(`${provisionOf(paragraph)}: ${ruleTitleFor(paragraph) ?? "not classified by this tool"}`);
    }
    line();
  }
  para(
    `**Assumed, established, and unknown are three different things here, and the difference matters more than the answer.** An *established* fact was answered by the person doing the interview. An *assumed* fact was not answered, so the ordinary answer was used and written down: ${
      decisive.length > 0
        ? `${plural(decisive.length, "assumption", "assumptions")} in this line would change the answer if wrong, and ${rest.length} would not.`
        : "nothing assumed in this line carries the answer."
    } An *unknown* fact has no safe default at all, so the generation it belongs to is reported as not answerable rather than answered either way${
      result.missing.length > 0
        ? `; there ${result.missing.length === 1 ? "is" : "are"} ${plural(result.missing.length, "of those", "of those")} here.`
        : "; there are none of those here."
    } Do not resolve an assumption or an unknown by picking whichever reading gives a cleaner answer. The documents named above are what settle them.`,
  );
  para(
    "**What this tool declines to do.** It stops rather than guess where a line contains an adoption, any loss and later restoration of citizenship, or somebody who already holds citizenship by grant. Those run on different mechanisms with different effective dates, and a wrong answer would be worse than none.",
  );
  para(
    `**The state block below is authoritative.** Everything above it is prose written for a person to read. The block is the interview itself, and it is what ${SITE_NAME} reads back: upload this file at ${url}/check/import and every answer is restored, with a trail back into any question. If the prose and the block ever disagree, the block is the data and the prose is a rendering of it.`,
  );

  // --- The state block ----------------------------------------------------

  if (options.line !== undefined) {
    line();
    line(STATE_HEADING);
    line();
    para(
      "Do not edit by hand. This is the interview, as data, and it is what an import reads. A hand-edited block that no longer describes a family line is refused with a message rather than half-loaded.",
    );
    out.push(...fenced(stateJson(options.line)));
    line();
  }

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type ParsedDocument =
  | { ok: true; line: LineDraft }
  /** A sentence to put in front of the user, not a code. */
  | { ok: false; reason: string };

/** Whether this text is a c3check document rather than, say, a GEDCOM file. */
export function looksLikeLineDocument(text: string): boolean {
  return text.includes(STATE_HEADING);
}

/**
 * The line a document carries, or why it does not carry one.
 *
 * Every failure is a message rather than a throw, because the input is a file
 * somebody chose off their own disk: an older download, a version mangled by a
 * mail client, a block someone edited to see what would happen. Validation is
 * `migrateLine`, the same function stored drafts go through, so there is one
 * definition of a well-formed line and it is already written never to throw and
 * to drop any fact outside the catalogue.
 */
export function parseLineDocument(text: string): ParsedDocument {
  const at = text.indexOf(STATE_HEADING);
  if (at === -1) {
    return {
      ok: false,
      reason:
        "That file does not look like a c3check download: it has no state block. If it is a family tree file, it needs a .ged or .gedcom extension to be read as one.",
    };
  }

  const fence = FENCE.exec(text.slice(at));
  if (fence === null) {
    return {
      ok: false,
      reason:
        "That file has a c3check state block but nothing inside it. If it was edited or truncated, try downloading it again.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fence[2]);
  } catch {
    return {
      ok: false,
      reason:
        "The state block in that file is not readable as data. It is meant not to be edited by hand; try downloading the file again.",
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("line" in parsed) ||
    (("format" in parsed) && parsed.format !== STATE_FORMAT)
  ) {
    return {
      ok: false,
      reason:
        "That file was written by a version of c3check this one cannot read. The result inside it is still readable as text.",
    };
  }

  const line = migrateLine((parsed as { line: unknown }).line);
  if (line === null) {
    return {
      ok: false,
      reason:
        "The state block in that file does not describe a family line with anybody in it, so there is nothing to restore.",
    };
  }
  return { ok: true, line };
}

/**
 * The first fenced block after the heading, and its contents.
 *
 * The closing fence is a backreference rather than another `{3,}`: the writer
 * lengthens the fence to clear any backticks in the data, and a loose pattern
 * would then close the block on a run *inside* it and hand `JSON.parse` half a
 * document.
 */
const FENCE = /(`{3,})[^\n]*\n([\s\S]*?)\n\1/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function stateJson(line: LineDraft): string {
  const document: LineDocument = {
    format: STATE_FORMAT,
    draftVersion: DRAFT_VERSION,
    // `updatedAt` is a clock reading the store stamps, and carrying it into a
    // file would make two downloads of the same line differ.
    line: { ...line, updatedAt: 0 },
  };
  return JSON.stringify(document, null, 2);
}

/**
 * A fenced block whose fence is longer than anything inside it.
 *
 * The block holds names somebody typed, and a name is allowed to contain three
 * backticks. A fixed fence would then end the block in the middle of the data,
 * and the file would not parse at all.
 */
function fenced(body: string, info = "json"): string[] {
  const longest = [...body.matchAll(/`+/g)].reduce(
    (most, match) => Math.max(most, match[0].length),
    0,
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}${info}`, body, fence];
}

/**
 * One table cell.
 *
 * A pipe in a user-typed name ends the cell early and shifts every column after
 * it, so it is escaped; a newline would end the row entirely, so it is folded to
 * a space. Nothing else is touched, and nothing is shortened.
 */
function cell(text: string): string {
  return humaniseDates(text)
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ");
}

function sourceLink(sourceId: string): string {
  const source = sourceById(sourceId);
  // `catalogue.test.ts` already guarantees every cited id resolves, so this is
  // defensive only: a rule added without its source should not produce a link to
  // nowhere in a file somebody keeps.
  if (source === undefined) return sourceId;
  return `[${source.title}, ${source.citation}](${source.url})`;
}

/** Every source the result actually cites, in the order it first cites them. */
function sourcesUsed(result: ChainResult): typeof SOURCES {
  const ids: string[] = [];
  const take = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const status of result.statuses) {
    for (const trace of status.trace) take(trace.sourceId);
    for (const flag of status.flags) take(flag.sourceId);
    if (status.stopReason !== null) take(status.stopReason.sourceId);
  }
  for (const advisory of result.advisories) take(advisory.sourceId);
  return ids
    .map((id) => sourceById(id))
    .filter((source): source is (typeof SOURCES)[number] => source !== undefined);
}

/** Every paragraph assigned anywhere in the chain, in chain order. */
function paragraphsInPlay(result: ChainResult): Paragraph[] {
  const seen: Paragraph[] = [];
  for (const status of result.statuses) {
    for (const paragraph of [status.paragraph, ...status.alternatives]) {
      if (paragraph !== null && !seen.includes(paragraph)) seen.push(paragraph);
    }
  }
  return seen;
}

function outcomeLine(status: Status): string {
  switch (status.outcome) {
    case "qualifies":
      return status.paragraph === null
        ? "Already a citizen under the Canadian Citizenship Act then in force, and no paragraph of section 3(1) as it now reads describes them, because none needs to."
        : "A citizen by operation of law, on the facts given.";
    case "fails":
      return "No paragraph of section 3(1) describes them on the facts given.";
    case "undetermined":
      return "Not answerable yet. Something this generation turns on has not been established.";
    case "stopped":
      return "This tool stops short of classifying this generation, on purpose.";
    case "incomplete":
      return "Nothing to reason from yet.";
  }
}

function traceWord(kind: Status["trace"][number]["kind"]): string {
  switch (kind) {
    case "matched":
      return "Matched";
    case "barred":
      return "Barred";
    case "unknown":
      return "Undecided";
    case "superseded":
      return "Superseded";
    case "not-matched":
      return "Did not apply";
    case "note":
      return "Note";
  }
}
