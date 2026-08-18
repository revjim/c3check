"use client";

/**
 * Importing a file: a family tree, or a c3check download.
 *
 * Two different jobs behind one file input, told apart by looking inside the
 * file rather than by trusting its extension. A GEDCOM is a starting point, and
 * every date and place in it is treated as a suggestion the interview still asks
 * about. A c3check markdown document is the opposite: it is an interview that was
 * already answered, so it is restored whole and lands on the result.
 *
 * Restoring is non-destructive. It appends a line and makes it current, the same
 * way starting one does, so somebody who imports a file over a half-finished
 * interview loses nothing.
 *
 * Three things about this screen are privacy decisions rather than design ones,
 * and all three are said out loud on the page rather than only in /privacy:
 *
 * 1. **The file is read in this browser and goes nowhere.** There is no upload,
 *    no endpoint, and nothing to opt out of.
 * 2. **The parsed file lives in React state and is never written to storage.**
 *    Only the people in the line you pick are copied into the saved draft.
 *    "Forget this file" and a page reload both discard it entirely.
 * 3. **Almost nothing in the file is even read.** The parser keeps names, sexes,
 *    dates, places and parent links, and drops notes, sources, photographs,
 *    addresses and causes of death at parse time. See `parse.ts`.
 *
 * Parsing happens in an event handler and never during render. A twenty
 * megabyte file takes a second or two, which a "reading your file" state
 * covers; a Web Worker is the escape hatch if that ever stops being true.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buttonClasses } from "@/components/button";
import { Radio, RadioGroup } from "./fields";
import { nextLineId } from "@/lib/draft";
import type { LineDraft } from "@/lib/draft";
import { updateDraft } from "@/lib/draftStore";
import { formatBirthDate, plural } from "@/lib/format";
import { isDone } from "@/lib/interview";
import { looksLikeLineDocument, parseLineDocument } from "@/lib/markdown";
import { describeGedcomDate } from "@/lib/gedcom/dates";
import {
  MAX_BYTES,
  birthDateOf,
  birthPlaceOf,
  isProbablyLiving,
  parseGedcom,
} from "@/lib/gedcom/parse";
import type { GedcomFile, GedcomIndividual } from "@/lib/gedcom/parse";
import { ancestralPaths } from "@/lib/gedcom/paths";
import type { AncestralPath } from "@/lib/gedcom/paths";
import { describePreview, lineFromPath, previewPath } from "@/lib/gedcom/toDraft";
import { useDraft } from "@/lib/useDraft";

type Stage =
  | { kind: "empty" }
  | { kind: "reading" }
  | { kind: "failed"; message: string }
  | { kind: "loaded"; file: GedcomFile; name: string }
  /** A c3check document, already restored, with the route change in flight. */
  | { kind: "restored"; lineName: string };

/** How many suggestions get the real engine run over them. */
const PREVIEWED = 5;

export function ImportRoot() {
  const draft = useDraft();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "empty" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function read(file: File) {
    if (file.size > MAX_BYTES) {
      // Checked before `.text()`, so a huge file never reaches memory at all.
      setStage({
        kind: "failed",
        message: `That file is ${Math.round(file.size / 1024 / 1024)} MB, and this reads files up to ${MAX_BYTES / 1024 / 1024} MB. Export a smaller part of your tree, or enter the line by hand.`,
      });
      return;
    }
    setStage({ kind: "reading" });
    try {
      const text = await file.text();
      // Sniffed, not taken from the extension. A GEDCOM saved as .md and a
      // c3check document saved as .txt are both things people do, and the
      // contents are unambiguous either way.
      if (looksLikeLineDocument(text)) {
        restore(text);
        return;
      }
      setStage({ kind: "loaded", file: parseGedcom(text), name: file.name });
      setChosen(null);
      setQuery("");
    } catch {
      setStage({
        kind: "failed",
        message: "That file could not be read from your device.",
      });
    }
  }

  /**
   * Puts a downloaded interview back, as a new line.
   *
   * The same three steps as `start()` below, and for the same reason: build the
   * line off-store, take an id from the draft, then append it and make it
   * current in one write. `pendingEdit` is dropped on the way in, because a
   * pinned question from whenever the file was saved is not where anybody
   * arriving from a file wants to land.
   */
  function restore(text: string) {
    const parsed = parseLineDocument(text);
    if (!parsed.ok) {
      setStage({ kind: "failed", message: parsed.reason });
      return;
    }
    const id = nextLineId(draft);
    const line: LineDraft = { ...parsed.line, id, pendingEdit: null };
    updateDraft((current) => ({
      ...current,
      lines: [...current.lines, line],
      currentLineId: id,
    }));
    setStage({ kind: "restored", lineName: line.name });
    // A finished file lands on the report, and the trail on the way back into it
    // is right there for changing any answer; an unfinished one carries on where
    // it left off. The same rule `CheckEntry.resume` follows.
    router.push(isDone(line) ? "/check/result" : "/check/interview");
  }

  function forget() {
    setStage({ kind: "empty" });
    setChosen(null);
    setQuery("");
  }

  function start(path: AncestralPath, file: GedcomFile) {
    const id = nextLineId(draft);
    const line = lineFromPath(file, path, id, nameFor(file, path));
    updateDraft((current) => ({
      ...current,
      lines: [...current.lines, line],
      currentLineId: id,
    }));
    router.push("/check/interview");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Start from a file
      </h1>
      <p className="mt-3 leading-7 text-muted">
        A GEDCOM export from Ancestry, MyHeritage, FamilySearch, Gramps or any
        other program. It saves typing; it does not save answering, because a
        family tree does not record the things the <em>Citizenship Act</em>{" "}
        turns on.
      </p>
      <p className="mt-3 leading-7 text-muted">
        Or a markdown file you downloaded from c3check yourself, from the foot of
        a result. That is a whole interview rather than a starting point: every
        answer comes back, and you land straight on the result with the trail
        back into any question.
      </p>

      <div className="mt-6 rounded-lg border border-brand/30 bg-brand/5 p-5 leading-7">
        <p>
          <strong className="font-semibold">
            Your file is read here, in this browser, and is not uploaded
            anywhere.
          </strong>{" "}
          It is held in the page while you use it and discarded the moment you
          reload or press &quot;Forget this file&quot;. Nothing from a family tree
          is saved on this device except the people in the line you actually
          choose. A c3check file is different by design: it is your own interview
          coming back, so all of it is restored.
        </p>
        <p className="mt-3 text-sm text-muted">
          Most of a family tree is never even read. This tool takes names, dates,
          places, sexes and parent links; it drops notes, sources, photographs,
          addresses and causes of death before they reach memory.{" "}
          <Link href="/privacy" className="text-brand underline underline-offset-4">
            More in the privacy policy
          </Link>
          .
        </p>
      </div>

      {stage.kind === "loaded" ? (
        <Loaded
          file={stage.file}
          fileName={stage.name}
          chosen={chosen}
          onChoose={setChosen}
          query={query}
          onQuery={setQuery}
          onStart={(path) => start(path, stage.file)}
          onForget={forget}
        />
      ) : (
        <Picker stage={stage} onFile={read} />
      )}
    </div>
  );
}

function Picker({
  stage,
  onFile,
}: {
  stage: Stage;
  onFile: (file: File) => void;
}) {
  return (
    <div className="mt-8">
      <label htmlFor="import-file" className="block text-sm font-medium">
        Choose a .ged family tree file, or a .md file you downloaded from here
      </label>
      {/* A plain file input rather than `next/form`, whose string-action path
          mishandles file inputs. Parsing happens in this handler and never
          during render. */}
      <input
        id="import-file"
        type="file"
        accept=".ged,.gedcom,.md"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file);
        }}
        className="mt-2 block w-full cursor-pointer rounded-lg border border-border bg-background p-3 text-sm file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      />

      <p aria-live="polite" className="mt-4 text-sm leading-6">
        {stage.kind === "reading" ? "Reading your file..." : null}
        {stage.kind === "restored"
          ? `Restored "${stage.lineName}". Opening it now...`
          : null}
        {stage.kind === "failed" ? (
          <span role="alert" className="font-medium text-brand">
            {stage.message}
          </span>
        ) : null}
      </p>

      <p className="mt-8 text-sm leading-6 text-muted">
        Would rather type it in?{" "}
        <Link href="/check" className="text-brand underline underline-offset-4">
          Start with yourself instead
        </Link>
        . Five generations is about ten minutes.
      </p>
    </div>
  );
}

function Loaded({
  file,
  fileName,
  chosen,
  onChoose,
  query,
  onQuery,
  onStart,
  onForget,
}: {
  file: GedcomFile;
  fileName: string;
  chosen: string | null;
  onChoose: (xref: string) => void;
  query: string;
  onQuery: (query: string) => void;
  onStart: (path: AncestralPath) => void;
  onForget: () => void;
}) {
  const people = useMemo(() => [...file.individuals.values()], [file]);

  // Searched by typed name rather than listed. A tree with four thousand people
  // in it is not a list anybody can read, and rendering one is slow as well as
  // useless.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return [];
    return people
      .filter((person) => (person.name ?? "").toLowerCase().includes(needle))
      .slice(0, 25);
  }, [people, query]);

  /**
   * The fallback for somebody who does not know how a name is spelled in their
   * own file, which is common: exporters mangle accents, and a maiden name is
   * often not the one the family uses. Anybody who is never recorded as a
   * parent is at the bottom of the tree, which is where an applicant almost
   * always is.
   */
  const youngest = useMemo(() => {
    const parents = new Set<string>();
    for (const family of file.families.values()) {
      if (family.husband !== null) parents.add(family.husband);
      if (family.wife !== null) parents.add(family.wife);
    }
    return people
      .filter((person) => !parents.has(person.xref))
      .sort((a, b) => birthKey(b).localeCompare(birthKey(a)))
      .slice(0, 25);
  }, [people, file]);

  const [browsing, setBrowsing] = useState(false);
  const listed = query.trim() === "" && browsing ? youngest : matches;

  const suggestions = useMemo(() => {
    if (chosen === null) return [];
    return ancestralPaths(file, chosen)
      .slice(0, PREVIEWED)
      .map((path) => ({ path, preview: previewPath(file, path) }));
  }, [file, chosen]);

  // Passed in rather than read inside the pure modules, which never touch a
  // clock. Recomputed per render, which is fine: it changes once a year.
  const thisYear = new Date().getFullYear();

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <p className="text-sm">
          <span className="font-medium">{fileName}</span>
          <span className="text-muted">
            {": "}
            {plural(file.individuals.size, "person", "people")},{" "}
            {plural(file.families.size, "family", "families")}
            {file.version === null ? null : `, GEDCOM ${file.version}`}
          </span>
        </p>
        <button type="button" onClick={onForget} className={buttonClasses("quiet")}>
          Forget this file
        </button>
      </div>

      {file.warnings.length === 0 ? null : (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
          {file.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-semibold tracking-tight">
        Who are we working out an answer for?
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Usually yourself. Type enough of the name to find them.
      </p>

      <div className="mt-4">
        <label htmlFor="who" className="block text-sm font-medium">
          Search your file by name
        </label>
        <input
          id="who"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        />
      </div>

      {query.trim() === "" && !browsing ? (
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className={buttonClasses("quiet", "mt-3 -ml-3")}
        >
          Or show me the most recent generation in the file
        </button>
      ) : null}

      {listed.length === 0 ? (
        query.trim() === "" ? null : (
          <p className="mt-4 text-sm text-muted">
            Nobody in this file has a name like that.
          </p>
        )
      ) : (
        <RadioGroup>
          {listed.map((person) => (
            <Radio
              key={person.xref}
              name="who-radio"
              value={person.xref}
              checked={chosen === person.xref}
              onChange={() => onChoose(person.xref)}
              label={person.name ?? person.xref}
              hint={describePerson(person, thisYear)}
            />
          ))}
        </RadioGroup>
      )}

      {chosen === null ? null : (
        <section aria-labelledby="lines" className="mt-12">
          <h2 id="lines" className="text-lg font-semibold tracking-tight">
            Which line should we follow?
          </h2>
          <p className="mt-2 leading-7 text-muted">
            This tool follows one parent at a time, because each generation of
            the Act depends on the one before it. These are ranked by how likely
            they look to reach an ancestor born in Canada, and each says what it
            currently produces when the real rules are run over it with no
            further answers.
          </p>

          {suggestions.length === 0 ? (
            <p className="mt-4 leading-7 text-muted">
              Your file records no parents for this person, so there is no line
              to follow from them yet.
            </p>
          ) : (
            <ol className="mt-6 space-y-4">
              {suggestions.map(({ path, preview }) => (
                <li
                  key={path.steps.map((step) => step.xref).join(">")}
                  className={`rounded-lg border p-5 ${
                    path.reachesAnchor
                      ? "border-brand/30 bg-brand/5"
                      : "border-border"
                  }`}
                >
                  <h3 className="font-medium">
                    {plural(path.steps.length, "generation", "generations")}
                    {path.reachesAnchor ? ", reaching Canada" : ""}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {path.steps
                      .map((step) => file.individuals.get(step.xref)?.name ?? "?")
                      .join(" -> ")}
                  </p>
                  <p className="mt-2 leading-7">{describePreview(preview)}</p>
                  {path.notes.length === 0 ? null : (
                    <ul className="mt-2 ml-5 list-disc space-y-1 text-sm leading-6 text-muted">
                      {path.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => onStart(path)}
                    className={buttonClasses("secondary", "mt-4")}
                  >
                    Use this line
                  </button>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-8 text-sm leading-6 text-muted">
            Nothing here looks right? Every date and place from your file is a
            starting point rather than an answer, and the interview asks about
            each generation whatever the file said, so you can correct anything
            as you go. You can also{" "}
            <Link
              href="/check"
              className="text-brand underline underline-offset-4"
            >
              enter a line by hand
            </Link>{" "}
            instead.
          </p>
        </section>
      )}
    </div>
  );
}

/** Sortable birth key, so browsing lists the most recent generation first. */
function birthKey(person: GedcomIndividual): string {
  const birth = birthDateOf(person);
  return birth === null || birth.date.kind === "unparsed" ? "" : birth.date.iso;
}

/** What to show beside a name in the picker. */
function describePerson(person: GedcomIndividual, thisYear: number): string {
  const birth = birthDateOf(person);
  const place = birthPlaceOf(person);
  const parts: string[] = [];

  if (isProbablyLiving(person, thisYear)) {
    // A birth date for somebody probably still alive is exactly the kind of
    // detail there is no reason to put on screen to identify them.
    parts.push("living");
  } else if (birth !== null && birth.date.kind !== "unparsed") {
    parts.push(
      `born ${formatBirthDate(birth.date.iso, birth.date.kind === "approximate")}`,
    );
    if (birth.from === "baptism") parts.push("from a baptism record");
  } else if (birth !== null) {
    parts.push(describeGedcomDate(birth.date));
  }

  if (place !== null) parts.push(place.place);
  return parts.join(", ");
}

/** A name for the new line, taken from where it ends up. */
function nameFor(file: GedcomFile, path: AncestralPath): string {
  const anchor = file.individuals.get(path.steps[0].xref);
  return anchor?.name == null
    ? "From your family tree"
    : `Through ${anchor.name}`;
}
