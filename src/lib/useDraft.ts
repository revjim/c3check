"use client";

/**
 * Reading the saved interview from a component.
 *
 * A thin wrapper over `useSyncExternalStore` so that no page has to remember
 * which of the three store functions goes in which argument, and so the
 * server-snapshot rule is stated once. See `draftStore.ts` for why the snapshot
 * caches its parse.
 */

import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/draftStore";
import { currentLine, lineById } from "@/lib/draft";
import type { Draft, LineDraft } from "@/lib/draft";

export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The line being worked on, or null before one has been started. */
export function useCurrentLine(): LineDraft | null {
  return currentLine(useDraft());
}

export function useLine(id: string | null): LineDraft | null {
  return lineById(useDraft(), id);
}
