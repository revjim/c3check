"use client";

/**
 * Print, copy as plain text, and download as markdown.
 *
 * The download is the only way work leaves this device on purpose, and the only
 * way it comes back: the file carries the interview in a fenced block, and
 * /check/import reads it. It is built here rather than on a server because there
 * is no server, so it is a Blob, an object URL, and a synthetic click, with the
 * URL revoked immediately afterwards.
 *
 * **The `beforeprint` handler is not decoration.** A closed `<details>` does
 * not print its contents, and there is no reliable way to force one open from
 * CSS alone, so the collapsed sections of the report, which include every
 * provision that was checked, would silently vanish from a printout. This opens
 * them all before the dialog and puts back exactly the ones that were closed
 * afterwards, so the page on screen looks the same as it did.
 *
 * **The help text is collapsed.** What the buttons do is legible from their
 * labels; the three paragraphs under them exist for the reader who wants to know
 * which file comes back, and putting them on the page open pushed the report
 * itself below the fold. It is a `Collapsible` like the report's own sections, so
 * `beforeprint` opens it along with the rest, which costs nothing here: this whole
 * block is `print:hidden`, so unlike the sections below it, nothing is lost from a
 * printout by leaving it shut.
 *
 * The clipboard falls back to a hidden textarea and `execCommand`, because
 * `navigator.clipboard` is unavailable over plain HTTP and in a few browsers
 * that people running an old machine to research their grandparents genuinely
 * still use.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/button";
import { Collapsible } from "./Collapsible";

export function ReportActions({
  reportFor,
  markdownFor,
  fileName,
  scopeId,
}: {
  /** Built on demand, so the text is never stale against the page. */
  reportFor: () => string;
  /** The same, as a markdown document carrying the interview. */
  markdownFor: () => string;
  /** What the downloaded file is called. ASCII, and ending in `.md`. */
  fileName: string;
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

  function download() {
    const blob = new Blob([markdownFor()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    // Appended before the click and removed after it: a detached anchor's click
    // is ignored in some browsers, and leaving it in the document would leave a
    // stray element inside the printable region.
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClasses("secondary")}
        >
          Print or save as PDF
        </button>
        <button
          type="button"
          onClick={download}
          className={buttonClasses("secondary")}
        >
          Download as markdown
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
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <Collapsible
          summary={
            <h2 className="text-sm font-medium">
              What each of these gives you, and which one comes back
            </h2>
          }
        >
          <div className="mt-3 space-y-2 text-sm leading-6 text-subtle">
            <p>
              The download is a markdown file, saved as{" "}
              <span className="font-mono break-all">{fileName}</span>. Markdown
              is ordinary text: it opens in any editor, notes app or mail
              client, and it reads as the report on this page, with every answer
              you gave written out in a fenced block at the foot.
            </p>
            <p>
              That block is what makes it the one thing here that comes back.
              Bring the file to{" "}
              <Link
                href="/check/import"
                className="text-brand underline underline-offset-4"
              >
                start from a file
              </Link>{" "}
              and the whole interview is restored: you land straight back on
              this result, free to change an answer, carry the line further, or
              start over from what you already entered instead of typing it
              again. A printout and the copied text are for reading only; this
              file is the one that can be read back in, so treat it as your save
              file.
            </p>
            <p>
              It holds every name, date and place you entered, for you and for
              your relatives. Nothing is uploaded to produce it, and from then
              on it is as private as wherever you keep it.
            </p>
          </div>
        </Collapsible>
      </div>
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
