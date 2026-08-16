"use client";

/**
 * Print, and copy as plain text.
 *
 * **The `beforeprint` handler is not decoration.** A closed `<details>` does
 * not print its contents, and there is no reliable way to force one open from
 * CSS alone, so the collapsed sections of the report, which include every
 * provision that was checked, would silently vanish from a printout. This opens
 * them all before the dialog and puts back exactly the ones that were closed
 * afterwards, so the page on screen looks the same as it did.
 *
 * The clipboard falls back to a hidden textarea and `execCommand`, because
 * `navigator.clipboard` is unavailable over plain HTTP and in a few browsers
 * that people running an old machine to research their grandparents genuinely
 * still use.
 */

import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/button";

export function ReportActions({
  reportFor,
  scopeId,
}: {
  /** Built on demand, so the text is never stale against the page. */
  reportFor: () => string;
  /** The id of the element whose `<details>` should be opened for printing. */
  scopeId: string;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scope = () => document.getElementById(scopeId);

    // Remember which were already open, so afterprint restores rather than
    // leaving the reader's page rearranged behind the dialog.
    let wasOpen: HTMLDetailsElement[] = [];

    function open() {
      const root = scope();
      if (root === null) return;
      const all = [...root.querySelectorAll("details")];
      wasOpen = all.filter((element) => element.open);
      for (const element of all) element.open = true;
    }

    function restore() {
      const root = scope();
      if (root === null) return;
      for (const element of root.querySelectorAll("details")) {
        element.open = wasOpen.includes(element);
      }
    }

    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", restore);
    };
  }, [scopeId]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const text = reportFor();
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = copyViaTextarea(text);
    }
    setCopied(ok ? "done" : "failed");
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 4000);
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={buttonClasses("secondary")}
      >
        Print or save as PDF
      </button>
      <button type="button" onClick={copy} className={buttonClasses("secondary")}>
        Copy as plain text
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {copied === "done"
          ? "Copied."
          : copied === "failed"
            ? "Could not reach the clipboard. Print to a PDF instead."
            : null}
      </span>
    </div>
  );
}

/** The fallback for a browser or a context where the clipboard API is absent. */
function copyViaTextarea(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
}
