/**
 * The saved interview, as an external store.
 *
 * Modelled on `consent.ts`: a `Set` of listeners, a `storage` listener so
 * another tab is noticed, every storage call in a `try`/`catch` so that private
 * browsing degrades to an in-memory draft rather than a broken page.
 *
 * One thing `consent.ts` does not have to worry about. It returns a `string`
 * from `getSnapshot`, so referential stability is free. A `Draft` is an object,
 * and `useSyncExternalStore` re-renders whenever `getSnapshot()` returns
 * something it has not seen before, so parsing on every call would render in an
 * infinite loop. So the snapshot reads the raw string every time (cheap),
 * compares it to the last raw string, and re-parses only when it has changed.
 *
 * No hydration trick is needed either: `useSyncExternalStore` renders
 * `getServerSnapshot()` during SSR and the hydration render and then re-reads
 * on the client, which is the sanctioned path and better behaved than a lazy
 * `useState` initialiser.
 */

import { DRAFT_KEY } from "@/lib/site";
import {
  emptyDraft,
  migrateDraft,
  parseDraft,
  serializeDraft,
} from "@/lib/draft";
import type { Draft, LineDraft } from "@/lib/draft";

/**
 * One frozen value, returned by every server render. A fresh object each time
 * would make React think the store changed between the SSR and hydration
 * passes.
 */
const EMPTY: Draft = Object.freeze(emptyDraft()) as Draft;

/** Used when storage throws, so the interview still works in private browsing. */
let fallback: Draft | null = null;

/** The raw text the cached snapshot was parsed from; `null` means "not read yet". */
let cachedRaw: string | null = null;
let cachedDraft: Draft = EMPTY;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function getSnapshot(): Draft {
  if (fallback !== null) return fallback;
  const raw = readRaw() ?? "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = parseDraft(raw === "" ? null : raw);
  }
  return cachedDraft;
}

export function getServerSnapshot(): Draft {
  return EMPTY;
}

/** Reads the draft outside React, for an event handler that needs it now. */
export function readDraft(): Draft {
  return getSnapshot();
}

export function writeDraft(draft: Draft): void {
  // Stamped here rather than in a reducer, so that every reducer stays a pure
  // function of its input and the tests never have to pin a clock.
  const now = Date.now();
  const stamped: Draft = {
    ...draft,
    lines: draft.lines.map((line) =>
      line.id === draft.currentLineId ? { ...line, updatedAt: now } : line,
    ),
  };
  const text = serializeDraft(stamped);

  try {
    window.localStorage.setItem(DRAFT_KEY, text);
    fallback = null;
    cachedRaw = text;
    cachedDraft = stamped;
  } catch {
    // Storage blocked or full. Hold the draft in memory so the interview still
    // works; it is lost on reload, which is better than losing it mid-question.
    fallback = stamped;
  }
  notify();
}

/** Applies a change to the whole draft and saves the result. */
export function updateDraft(change: (draft: Draft) => Draft): Draft {
  const next = change(getSnapshot());
  writeDraft(next);
  return next;
}

/**
 * Applies a change to one line and saves. Returns the draft, unchanged if the
 * line has gone: a stale reference from a page that was open in another tab
 * should not resurrect a deleted line.
 */
export function updateLine(
  lineId: string,
  change: (line: LineDraft) => LineDraft,
): Draft {
  return updateDraft((draft) => {
    const existing = draft.lines.find((line) => line.id === lineId);
    if (existing === undefined) return draft;
    const next = change(existing);
    return {
      ...draft,
      lines: draft.lines.map((line) => (line.id === lineId ? next : line)),
    };
  });
}

/**
 * Erases the saved interview.
 *
 * Called by `consent.clearStoredData`, which already removes the key: without
 * this the cached snapshot would go stale and no subscriber would be told, so
 * the interview would carry on displaying a draft that is no longer there.
 */
export function resetDraft(): void {
  fallback = null;
  cachedRaw = "";
  cachedDraft = EMPTY;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing was stored in the first place.
  }
  notify();
}

/**
 * Replaces the stored draft wholesale, validating it on the way in. Used by the
 * error boundary's recovery path and by nothing else.
 */
export function replaceDraft(raw: unknown): void {
  writeDraft(migrateDraft(raw));
}
