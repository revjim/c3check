"use client";

/**
 * The one client component under /check/interview.
 *
 * It has to be inside a `<Suspense>` boundary because it calls
 * `useSearchParams`. On a statically rendered route that works in `next dev`
 * and **fails the production build**, so the failure shows up in CI rather than
 * locally. The boundary lives in the page; this file is where the requirement
 * comes from.
 *
 * `?step=N` is an **opaque ordinal into the recomputed queue**, never an
 * identifier. "Did your grandmother stop being a British subject" landing in
 * browser history is exactly what /privacy promises will not happen, and an
 * ordinal is what lets that promise be stated as strongly as it is. Reading it
 * back clamps to the queue; no answer can be lost that way, because answers
 * live in the draft rather than in the URL.
 *
 * Navigation is `window.history.pushState`, which integrates with the Next
 * router and syncs with `useSearchParams`, so there is no `popstate` listener
 * here and browser Back works for free. The trail (`StepTrail`) pushes the same
 * kind of entry, which is what makes a jump backwards undoable by Back rather
 * than a one-way trip.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { AddAncestorStep } from "./AddAncestorStep";
import { ConfirmStep } from "./ConfirmStep";
import { FactStep } from "./FactStep";
import { PersonStep } from "./PersonStep";
import { PresenceStep } from "./PresenceStep";
import { StatusStrip } from "./StatusStrip";
import { StepTrail } from "./StepTrail";
import { buttonClasses } from "@/components/button";
import { currentLine, personById, setPendingEdit } from "@/lib/draft";
import type { LineDraft } from "@/lib/draft";
import { updateLine } from "@/lib/draftStore";
import {
  advanceFrom,
  applyAnswer,
  confirmSubjects,
  crumbTrail,
  currentIndex,
  stepAt,
  stepFromRef,
  stepKey,
} from "@/lib/interview";
import type { AnswerValue, Step } from "@/lib/interview";
import { useDraft } from "@/lib/useDraft";

export function InterviewRoot() {
  const draft = useDraft();
  const searchParams = useSearchParams();
  const line = currentLine(draft);

  if (line === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          There is nothing in progress on this device
        </h1>
        <p className="mt-3 leading-7 text-muted">
          Interviews are saved in your own browser and nowhere else, so a
          different device or a cleared browser starts from scratch.
        </p>
        <Link href="/check" className={buttonClasses("primary", "mt-8")}>
          Start a family line
        </Link>
      </div>
    );
  }

  const raw = searchParams.get("step");
  const requested = raw === null ? null : Number(raw);
  const index =
    requested !== null && Number.isInteger(requested) && requested >= 0
      ? requested
      : currentIndex(line);

  // A pending edit set by "change this answer" on the results page overrides the
  // ordinal, because ordinals shift as the queue changes and a stored link
  // built from one would rot.
  const step =
    line.pendingEdit !== null
      ? stepFromRef(line.pendingEdit)
      : stepAt(line, index);

  return (
    <Interview line={line} step={step} index={index} pinned={raw !== null} />
  );
}

function Interview({
  line,
  step,
  index,
  pinned,
}: {
  line: LineDraft;
  step: Step;
  index: number;
  /** Whether the current history entry already names the step it is showing. */
  pinned: boolean;
}) {
  const heading = useRef<HTMLDivElement>(null);
  const key = stepKey(step);

  // The first arrival here comes from a `router.push("/check/interview")` with
  // no query, so that history entry names no step and re-resolves to whatever
  // the frontier is by the time the user comes back to it. Pressing Back from
  // the second question then lands on the second question again. Writing the
  // ordinal in without adding an entry pins it to the question it is actually
  // showing, which is what makes Back work.
  useEffect(() => {
    if (!pinned) window.history.replaceState(null, "", `?step=${index}`);
  }, [pinned, index]);

  // Focus moves to the top of the question on every step change, so a keyboard
  // or screen-reader user is not left at the bottom of the previous form.
  useEffect(() => {
    heading.current?.focus();
  }, [key]);

  function answer(value: AnswerValue) {
    // The ordinal is worked out first, from a throwaway copy, and the URL is
    // pushed before the store is written. The other order renders once with the
    // new line and the old ordinal, which lands on the wrong question for a
    // frame; combined with the fact that two consecutive person screens are the
    // same component in the same position, that frame is enough for React to
    // keep the previous person's answers in the form. `applyAnswer` is pure and
    // a chain classification is a fraction of a millisecond, so running it twice
    // costs nothing and keeps the store's read-modify-write honest against
    // another tab.
    const advanced = advanceFrom(applyAnswer(line, step, value), index);
    window.history.pushState(null, "", `?step=${advanced}`);
    updateLine(line.id, (current) => applyAnswer(current, step, value));
  }

  // A crumb is a real history entry, so browser Back undoes the jump. Any
  // pending edit goes with it: it pins the interview to one screen, and
  // somebody navigating the trail is done with that screen.
  function go(to: number) {
    window.history.pushState(null, "", `?step=${to}`);
    if (line.pendingEdit !== null) {
      updateLine(line.id, (current) => setPendingEdit(current, null));
    }
  }

  const trail = crumbTrail(line, step);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <StatusStrip line={line} />
      <StepTrail groups={trail} onGo={go} />

      <div
        ref={heading}
        tabIndex={-1}
        className="mt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        {/* Keyed on the step, so moving between screens always remounts. Two
            consecutive person screens are the same component in the same
            position, and without this React reuses the form state: the second
            ancestor's screen opens showing the first one's birth date, already
            filled in and looking like an answer. */}
        <StepBody
          key={key}
          line={line}
          step={step}
          hasTrail={trail.length > 0}
          onAnswer={answer}
        />
      </div>

      {step.kind === "done" ? null : (
        <div className="mt-12 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className={buttonClasses("quiet")}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}

function StepBody({
  line,
  step,
  hasTrail,
  onAnswer,
}: {
  line: LineDraft;
  step: Step;
  /** Whether the last screen can point at a trail above it, or has none to name. */
  hasTrail: boolean;
  onAnswer: (value: AnswerValue) => void;
}) {
  switch (step.kind) {
    case "person": {
      const person = personById(line, step.personId);
      if (person === null) return <Missing />;
      return <PersonStep line={line} person={person} onAnswer={onAnswer} />;
    }

    case "fact": {
      const person = personById(line, step.personId);
      if (person === null) return <Missing />;
      // The one fact that is a number rather than a yes or a no.
      if (step.factId === "presenceDaysInCanada") {
        return <PresenceStep line={line} person={person} onAnswer={onAnswer} />;
      }
      return (
        <FactStep
          line={line}
          person={person}
          factId={step.factId}
          onAnswer={onAnswer}
        />
      );
    }

    case "confirm": {
      const person = personById(line, step.personId);
      if (person === null) return <Missing />;
      return (
        <ConfirmStep
          line={line}
          person={person}
          assumptions={confirmSubjects(line, step)}
          onAnswer={onAnswer}
        />
      );
    }

    case "add-ancestor": {
      const person = personById(line, step.childId);
      if (person === null) return <Missing />;
      return <AddAncestorStep line={line} person={person} onAnswer={onAnswer} />;
    }

    case "done":
      return <Done hasTrail={hasTrail} />;
  }
}

function Done({ hasTrail }: { hasTrail: boolean }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        There is enough here for an answer
      </h1>
      <p className="mt-3 leading-7 text-muted">
        Nothing left to ask that could change it. The result shows every
        generation, the paragraph that applies to each, what the answer rests on,
        and what is still unknown.
      </p>
      <p className="mt-3 leading-7 text-muted">
        Nothing is closed off.{" "}
        {hasTrail
          ? "Every answer you gave is in the trail above, and the result has a control beside anything it assumed or could not settle."
          : "The result has a control beside anything it assumed or could not settle."}
      </p>
      <Link href="/check/result" className={buttonClasses("primary", "mt-8")}>
        See the result
      </Link>
    </div>
  );
}

/**
 * A step pointing at somebody who is no longer in the line. `migrateDraft`
 * drops a stored `pendingEdit` like that, so this needs another tab to have
 * deleted the person in between renders. Recoverable, so not an error.
 */
function Missing() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        That question is no longer part of this line
      </h1>
      <p className="mt-3 leading-7 text-muted">
        The generation it was about has been removed, most likely in another
        tab.
      </p>
      <Link href="/check/interview" className={buttonClasses("primary", "mt-8")}>
        Carry on where you left off
      </Link>
    </div>
  );
}
