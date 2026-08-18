"use client";

/**
 * The report.
 *
 * This is the only place `classifyChain` runs with the default
 * `assessAssumptions: true`, which re-runs the whole chain once per boolean
 * default in order to find which of them actually carry the answer. That is
 * forty-odd extra runs for a five-generation line, and worth every one: it is
 * the difference between "here are forty things we assumed" and "three of these
 * would change your answer".
 *
 * There is no `useSearchParams` anywhere below here, so this route needs no
 * Suspense boundary. /check/interview is the exception and says why.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Advisories } from "./Advisories";
import { ChainTable } from "./ChainTable";
import { Headline } from "./Headline";
import { PersonCard } from "./PersonCard";
import { ReportActions } from "./ReportActions";
import {
  Assumptions,
  Checklist,
  Flags,
  Reasoning,
  StillUnknown,
} from "./ResultSections";
import { SourceLink } from "./SourceLink";
import { buttonClasses } from "@/components/button";
import { ClearDataButton } from "@/components/ClearDataButton";
import type { FactId, MissingFact } from "@/lib/c3";
import {
  classifyLine,
  currentLine,
  isCompleteLine,
  personById,
  setFact,
  setPendingEdit,
} from "@/lib/draft";
import type { LineDraft } from "@/lib/draft";
import { updateLine } from "@/lib/draftStore";
import { formatDate, humaniseDates } from "@/lib/format";
import { reportMarkdown } from "@/lib/markdown";
import { groupAssumptions, reportText } from "@/lib/report";
import { ACT_AS_OF } from "@/lib/sources";
import { SITE_URL } from "@/lib/site";
import { useDraft } from "@/lib/useDraft";

const SCOPE = "c3check-report";

export function ResultRoot() {
  const draft = useDraft();
  const line = currentLine(draft);

  if (line === null || !isCompleteLine(line)) {
    return <NotReady hasLine={line !== null} />;
  }
  return <Report line={line} />;
}

/**
 * Split from the guard above rather than merged into it, because a hoisted
 * function declaration does not see the control-flow narrowing that made `line`
 * non-null, and every handler below is one.
 */
function Report({ line }: { line: LineDraft }) {
  const router = useRouter();

  const result = classifyLine(line);
  if (result === null) return <NotReady hasLine />;

  function override(personId: string, factId: FactId) {
    // Inverting the default is the whole meaning of "that is not right": every
    // one of the thirteen defaulted facts defaults to false.
    updateLine(line.id, (current) => setFact(current, personId, factId, true));
  }

  function undoConfirmation(personId: string, factId: FactId) {
    updateLine(line.id, (current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === personId
          ? {
              ...person,
              acceptedDefaults: person.acceptedDefaults.filter(
                (id) => id !== factId,
              ),
            }
          : person,
      ),
    }));
  }

  function answerNow(fact: MissingFact) {
    // A stored step reference rather than a step number: ordinals shift as the
    // queue changes, and a link built from one would rot.
    updateLine(line.id, (current) =>
      setPendingEdit(current, {
        kind: "fact",
        personId: fact.personId,
        factId: fact.factId,
      }),
    );
    router.push("/check/interview");
  }

  function editPerson(personId: string) {
    updateLine(line.id, (current) =>
      setPendingEdit(current, { kind: "person", personId }),
    );
    router.push("/check/interview");
  }

  const groups = groupAssumptions(result, (personId, factId) =>
    (personById(line, personId)?.acceptedDefaults ?? []).includes(
      factId as FactId,
    ),
  );

  const stop = result.applicant.stopReason;

  return (
    <div id={SCOPE} className="mx-auto w-full max-w-3xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{line.name}</h1>
        <p className="mt-2 leading-7 text-muted">
          Every generation you entered, the paragraph of section 3 of the{" "}
          <em>Citizenship Act</em> that applies to each, and what the answer
          rests on.
        </p>
      </header>

      <ReportActions
        scopeId={SCOPE}
        reportFor={() =>
          reportText(result, {
            lineName: line.name,
            // Not a clock inside the pure module: the date is read here, at
            // the moment the user asks for the text, and passed in already
            // formatted the way the rest of the report writes dates.
            generatedOn: formatDate(new Date().toISOString().slice(0, 10)),
          })
        }
        markdownFor={() =>
          reportMarkdown(result, {
            // The line itself, not only its name: the document carries the
            // interview in a fenced block, which is what makes it readable back.
            line,
            generatedOn: formatDate(new Date().toISOString().slice(0, 10)),
          })
        }
        fileName={fileNameFor(line.name)}
      />

      {stop === null ? null : <StopBlock line={line} result={result} />}

      <div className="mt-8">
        <Headline result={result} stopped={stop !== null} />
      </div>

      <ChainTable result={result} />

      <Advisories
        result={result}
        line={line}
        onSetFact={(personId, factId, value) =>
          updateLine(line.id, (current) =>
            setFact(current, personId, factId, value),
          )
        }
      />

      <section
        aria-labelledby="generations"
        className="mt-8 border-t border-border pt-8"
      >
        <h2 id="generations" className="text-lg font-semibold tracking-tight">
          Generation by generation
        </h2>
        <p className="mt-2 leading-7 text-muted">
          Everything the engine has to say about each person, in full. Open a
          generation for its dates, its effective date and what set it, the
          paragraphs that also described them, and IRCC&apos;s own processing
          category.
        </p>
        <ol className="mt-6 space-y-5">
          {result.statuses.map((status, index) => (
            <PersonCard
              key={status.personId}
              status={status}
              index={index}
              approximateBirth={
                personById(line, status.personId)?.birthDateApproximate ?? false
              }
            >
              <button
                type="button"
                onClick={() => editPerson(status.personId)}
                className={buttonClasses("quiet", "mt-4 -ml-3 print:hidden")}
              >
                Change these details
              </button>
            </PersonCard>
          ))}
        </ol>
      </section>

      <Flags result={result} />

      <Assumptions
        groups={groups}
        onOverride={override}
        onUndo={undoConfirmation}
      />

      <StillUnknown missing={result.missing} onAnswerNow={answerNow} />

      <Checklist result={result} />

      <Reasoning result={result} />

      <footer className="mt-16 break-inside-avoid border-t border-border pt-6 text-sm leading-6 text-muted">
        <p>
          Worked out against the <em>Citizenship Act</em> as amended{" "}
          {ACT_AS_OF}, by c3check, <span className="font-mono">{SITE_URL}</span>.
        </p>
        <p className="mt-2">
          <strong className="font-medium text-foreground">
            Not legal or immigration advice
          </strong>{" "}
          and not written by a lawyer. Only IRCC can decide whether you are a
          citizen. Verify any of this against the{" "}
          <Link href="/sources" className="text-brand underline underline-offset-4">
            primary sources
          </Link>{" "}
          and consult a licensed lawyer or a CICC member before acting on it.
        </p>
        <div className="print:hidden">
          <p className="mt-6">
            Everything above was worked out in this browser and stored only on
            this device.
          </p>
          <ClearDataButton />
        </div>
      </footer>
    </div>
  );
}

/**
 * What the downloaded file is called.
 *
 * A line name is whatever somebody typed, so it is reduced to ASCII letters,
 * digits and dashes rather than trusted: it becomes a file name on their disk,
 * and possibly an attachment name in somebody else's mail client.
 */
function fileNameFor(lineName: string): string {
  const slug = lineName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `c3check-${slug === "" ? "line" : slug}.md`;
}

/**
 * A halted chain gets its own block, above everything, and demotes the
 * headline. "Stopped" is not "no", and the difference is the whole point of
 * having the state at all.
 */
function StopBlock({
  line,
  result,
}: {
  line: LineDraft;
  result: NonNullable<ReturnType<typeof classifyLine>>;
}) {
  const stop = result.applicant.stopReason;
  if (stop === null) return null;
  const at = result.statuses.find((status) => status.stopReason !== null);

  return (
    <section
      aria-labelledby="stopped"
      className="mt-8 break-inside-avoid rounded-lg border border-border bg-surface p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-subtle">
        This tool stops here
      </p>
      <h2 id="stopped" className="mt-2 text-xl font-semibold tracking-tight">
        {at?.stopReason?.title ?? stop.title}
      </h2>
      <p className="mt-3 leading-7">
        {humaniseDates(at?.stopReason?.detail ?? stop.detail)}
      </p>
      <p className="mt-4 leading-7 text-muted">
        <strong className="font-medium text-foreground">
          This tool stops here on purpose rather than guess. That is not a
          &quot;no&quot;.
        </strong>{" "}
        It means the situation runs on rules this version does not model, and a
        wrong answer would be worse than none. A lawyer or a CICC member can
        take it from here, and the provisions below are where to start reading.
      </p>
      <p className="mt-4 text-sm text-muted">
        <span className="font-mono">
          {at?.stopReason?.provision ?? stop.provision}
        </span>
        {". "}
        <SourceLink sourceId={at?.stopReason?.sourceId ?? stop.sourceId} />
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4 print:hidden">
        <Link href="/check/lines" className={buttonClasses("secondary")}>
          Try the other parent&apos;s line
        </Link>
        <Link
          href="/sources"
          className="text-sm text-brand underline underline-offset-4"
        >
          Read the sources
        </Link>
      </div>
      <p className="sr-only">{line.name}</p>
    </section>
  );
}

function NotReady({ hasLine }: { hasLine: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {hasLine
          ? "There is not enough here for a result yet"
          : "There is nothing in progress on this device"}
      </h1>
      <p className="mt-3 leading-7 text-muted">
        {hasLine
          ? "At least one generation is still missing a birth date, a place of birth, or whether they are still living. The interview asks for those before anything else, because none of the rules can be applied without them."
          : "Interviews are saved in your own browser and nowhere else, so a different device or a cleared browser starts from scratch."}
      </p>
      <Link
        href={hasLine ? "/check/interview" : "/check"}
        className={buttonClasses("primary", "mt-8")}
      >
        {hasLine ? "Carry on with the interview" : "Start a family line"}
      </Link>
    </div>
  );
}
