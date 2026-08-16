"use client";

/**
 * Saved lines: rename, fork, delete, switch, compare.
 *
 * This is where "try the other parent's line" actually happens. A fork keeps
 * the person you pick and everyone descended from them and drops the ancestors
 * above, then drops you back into the interview at "who was their parent?" with
 * the other parent to hand. The original is untouched, because the point of
 * forking is to have both.
 *
 * A verdict does appear here, unlike anywhere in the interview, and that is
 * fine: these lines are finished or they are not, and the summary says which.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClasses } from "@/components/button";
import { provisionOf } from "@/lib/c3";
import {
  addLine,
  classifyLine,
  deleteLine,
  forkLine,
  isCompleteLine,
  labelOf,
  renameLine,
  setCurrentLine,
} from "@/lib/draft";
import type { Draft, LineDraft } from "@/lib/draft";
import { updateDraft } from "@/lib/draftStore";
import { formatDate, plural } from "@/lib/format";
import { isDone, progressSummary } from "@/lib/interview";
import { verdictWord } from "@/lib/report";
import { useDraft } from "@/lib/useDraft";

export function LinesRoot() {
  const draft = useDraft();
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  function open(line: LineDraft) {
    updateDraft((current) => setCurrentLine(current, line.id));
    router.push(isDone(line) ? "/check/result" : "/check/interview");
  }

  function fork(line: LineDraft, personId: string) {
    const person = line.people.find((entry) => entry.id === personId);
    const name = `${labelOf(line, person ?? line.people[0])}, the other parent`;
    let target: string | null = null;
    updateDraft((current) => {
      const forked = forkLine(current, line.id, personId, name);
      if (forked === null) return current;
      target = forked.lineId;
      return forked.draft;
    });
    if (target !== null) router.push("/check/interview");
  }

  if (draft.lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          No lines saved on this device
        </h1>
        <p className="mt-3 leading-7 text-muted">
          Lines are saved in your own browser and nowhere else.
        </p>
        <Link href="/check" className={buttonClasses("primary", "mt-8")}>
          Start a family line
        </Link>
      </div>
    );
  }

  const comparable = draft.lines.filter(
    (line) => isCompleteLine(line) && isDone(line),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Saved lines</h1>
      <p className="mt-2 leading-7 text-muted">
        Each one follows a single parent at a time, because each generation of
        the Act depends on the one before it and a family tree has no single
        answer to give. Fork a line to follow the other parent instead, and
        compare what the two produce.
      </p>

      {comparable.length > 1 ? <Comparison lines={comparable} /> : null}

      <ul className="mt-10 space-y-5">
        {draft.lines.map((line) => (
          <li
            key={line.id}
            className={`rounded-lg border p-5 ${
              line.id === draft.currentLineId
                ? "border-brand/30 bg-brand/5"
                : "border-border"
            }`}
          >
            {renaming === line.id ? (
              <RenameForm
                line={line}
                onDone={(name) => {
                  updateDraft((current) => renameLine(current, line.id, name));
                  setRenaming(null);
                }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg font-medium">{line.name}</h2>
                {line.id === draft.currentLineId ? (
                  <p className="text-sm text-subtle">Currently open</p>
                ) : null}
              </div>
            )}

            <p className="mt-2 text-sm leading-6 text-muted">
              {progressSummary(line)}
              {line.forkedFrom === undefined
                ? null
                : " Forked from another line."}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {summaryOf(line)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => open(line)}
                className={buttonClasses("secondary")}
              >
                {isDone(line) ? "See the result" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => setRenaming(line.id)}
                className={buttonClasses("quiet")}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmingDelete(
                    confirmingDelete === line.id ? null : line.id,
                  )
                }
                className={buttonClasses("quiet")}
              >
                Delete
              </button>
            </div>

            {confirmingDelete === line.id ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                <p className="text-sm leading-6">
                  Delete <strong className="font-medium">{line.name}</strong>{" "}
                  and everything entered in it? There is no undo, and nothing is
                  stored anywhere else that could bring it back.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft((current) => deleteLine(current, line.id));
                      setConfirmingDelete(null);
                    }}
                    className={buttonClasses("secondary")}
                  >
                    Yes, delete it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(null)}
                    className={buttonClasses("quiet")}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : null}

            {line.people.length > 1 ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted">
                  Follow a different parent from here
                </summary>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Pick the generation whose parent you want to change. Everyone
                  from them down is copied into a new line; everyone above them
                  is dropped, because those are the ancestors reached through
                  the parent you are swapping out. This line is left as it is.
                </p>
                <ul className="mt-3 space-y-2">
                  {line.people.slice(0, -1).map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => fork(line, person.id)}
                        className={buttonClasses("secondary")}
                      >
                        {labelOf(line, person)}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <button
          type="button"
          onClick={() => {
            updateDraft((current) => addLine(current, nameFor(current)));
            router.push("/check/interview");
          }}
          className={buttonClasses("secondary")}
        >
          Start another line
        </button>
      </div>
    </div>
  );
}

/** Two headlines side by side, which is the whole point of having two lines. */
function Comparison({ lines }: { lines: LineDraft[] }) {
  return (
    <section aria-labelledby="compare" className="mt-10">
      <h2 id="compare" className="text-lg font-semibold tracking-tight">
        Side by side
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                Line
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Answer
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Paragraph
              </th>
              <th scope="col" className="py-2 font-medium">
                Effective
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const headline = classifyLine(line)?.headline ?? null;
              return (
                <tr key={line.id} className="border-b border-border align-top">
                  <th scope="row" className="py-3 pr-4 text-left font-medium">
                    {line.name}
                  </th>
                  <td className="py-3 pr-4 text-muted">
                    {headline === null ? "-" : verdictWord(headline.verdict)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-muted">
                    {headline?.paragraph === null ||
                    headline?.paragraph === undefined
                      ? "-"
                      : provisionOf(headline.paragraph)}
                  </td>
                  <td className="py-3 text-muted">
                    {headline?.effectiveDate == null
                      ? "-"
                      : formatDate(headline.effectiveDate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RenameForm({
  line,
  onDone,
  onCancel,
}: {
  line: LineDraft;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(line.name);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed !== "") onDone(trimmed);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="grow">
        <label
          htmlFor={`rename-${line.id}`}
          className="block text-sm font-medium"
        >
          Name for this line
        </label>
        <input
          id={`rename-${line.id}`}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        />
      </div>
      <button type="submit" className={buttonClasses("secondary")}>
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={buttonClasses("quiet")}
      >
        Cancel
      </button>
    </form>
  );
}

/** Structural, and only a verdict once the line is actually finished. */
function summaryOf(line: LineDraft): string {
  if (!isCompleteLine(line)) {
    return `${plural(line.people.length, "generation", "generations")} started.`;
  }
  if (!isDone(line)) return "Some questions are still outstanding.";
  const headline = classifyLine(line)?.headline;
  if (headline === undefined) return "";
  return verdictWord(headline.verdict);
}

function nameFor(draft: Draft): string {
  const ordinals = [
    "Your line",
    "Second line",
    "Third line",
    "Fourth line",
    "Fifth line",
  ];
  return ordinals[draft.lines.length] ?? `Line ${draft.lines.length + 1}`;
}
