"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/button";
import { clearStoredData } from "@/lib/consent";

/**
 * Wipes everything c3check has stored on this device: the saved interview and
 * the record that the terms were accepted. Deliberately clears both, someone
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
        className={buttonClasses("secondary")}
      >
        Clear my data
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {cleared ? "Cleared from this browser." : null}
      </span>
    </div>
  );
}
