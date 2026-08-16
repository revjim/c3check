"use client";

/**
 * The front door of /check.
 *
 * Two states, and which one you see depends entirely on what is in this
 * browser's storage: nothing saved, so start; or something saved, so resume.
 * It never shows a verdict here. `progressSummary` is structural by design, and
 * the reasons are in `StatusStrip.tsx`.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/button";
import { addLine, isCompleteLine, setCurrentLine } from "@/lib/draft";
import type { Draft, LineDraft } from "@/lib/draft";
import { updateDraft } from "@/lib/draftStore";
import { isDone, progressSummary } from "@/lib/interview";
import { plural } from "@/lib/format";
import { useDraft } from "@/lib/useDraft";

export function CheckEntry() {
  const draft = useDraft();
  const router = useRouter();

  function start() {
    updateDraft((current) => addLine(current, nameFor(current)));
    router.push("/check/interview");
  }

  function resume(line: LineDraft) {
    updateDraft((current) => setCurrentLine(current, line.id));
    router.push(isDone(line) ? "/check/result" : "/check/interview");
  }

  if (draft.lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Start with yourself and work backwards
        </h1>
        <p className="mt-4 leading-7 text-muted">
          Your birth date and where you were born, then your parent, then
          theirs, until the line reaches someone born in Canada. Most of the
          questions never get asked: you only see the ones that could change the
          answer, and each one says why it is being asked.
        </p>
        <p className="mt-4 leading-7 text-muted">
          Nothing you enter is sent anywhere. It is saved in this browser so a
          refresh does not lose your work, which is worth knowing if you are on a
          shared computer.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="button" onClick={start} className={buttonClasses("primary")}>
            Start with yourself
          </button>
          <Link href="/check/import" className={buttonClasses("secondary")}>
            Import a family tree file
          </Link>
        </div>
        <p className="mt-3 text-sm leading-6 text-subtle">
          A GEDCOM file is read in this browser and never uploaded. It saves
          typing; it does not save answering.
        </p>

        <p className="mt-8 text-sm leading-6 text-subtle">
          You can stop at any point and come back. There is no account and
          nothing to sign up for.{" "}
          <Link href="/privacy" className="text-brand underline underline-offset-4">
            What is stored, exactly
          </Link>
          .
        </p>
      </div>
    );
  }

  const current = draft.lines.find((line) => line.id === draft.currentLineId);
  const others = draft.lines.filter((line) => line.id !== current?.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pick up where you left off
      </h1>
      <p className="mt-3 leading-7 text-muted">
        Saved in this browser, and nowhere else.
      </p>

      {current === undefined ? null : (
        <LineCard line={current} onOpen={() => resume(current)} emphasis />
      )}

      {others.length > 0 ? (
        <>
          <h2 className="mt-12 text-sm font-semibold uppercase tracking-widest text-subtle">
            {plural(others.length, "other line", "other lines")}
          </h2>
          <div className="mt-4 space-y-3">
            {others.map((line) => (
              <LineCard key={line.id} line={line} onOpen={() => resume(line)} />
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <button type="button" onClick={start} className={buttonClasses("secondary")}>
          Start another line
        </button>
        <Link href="/check/import" className={buttonClasses("secondary")}>
          Import a family tree file
        </Link>
        <Link href="/check/lines" className="text-sm text-brand underline underline-offset-4">
          Manage saved lines
        </Link>
      </div>
    </div>
  );
}

function LineCard({
  line,
  onOpen,
  emphasis = false,
}: {
  line: LineDraft;
  onOpen: () => void;
  emphasis?: boolean;
}) {
  const ready = isCompleteLine(line) && isDone(line);
  return (
    <div
      className={`mt-6 rounded-lg border p-5 ${
        emphasis ? "border-brand/30 bg-brand/5" : "border-border"
      }`}
    >
      <h3 className="font-medium">{line.name}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">
        {progressSummary(line)}
      </p>
      <button type="button" onClick={onOpen} className={buttonClasses("secondary", "mt-4")}>
        {ready ? "See the result" : "Continue"}
      </button>
    </div>
  );
}

/** "Your line", then "Second line", "Third line", and numbers after that. */
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
