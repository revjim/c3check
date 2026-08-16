"use client";

import { useState } from "react";
import { clearStoredData } from "@/lib/consent";

/**
 * Wipes everything c3check has stored on this device: the saved interview and
 * the record that the terms were accepted. Deliberately clears both — someone
 * asking to be forgotten should not be left with a stale consent flag.
 */
export function ClearDataButton() {
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    clearStoredData();
    setCleared(true);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClear}
        className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Clear my data
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {cleared ? "Cleared from this browser." : null}
      </span>
    </div>
  );
}
