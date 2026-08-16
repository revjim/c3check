/**
 * Every line of descent through a family tree, ranked.
 *
 * The engine follows one line at a time, so a tree with a dozen ancestors has a
 * dozen candidate lines and the useful thing to do is find the ones that reach
 * Canada. This walks up through `FAMC` to `HUSB` and `WIFE`, one parent per
 * step, so every path is a distinct line, and returns each anchor-first so it
 * hands straight to `classifyChain`.
 *
 * **The ranking does not score legal merit, on purpose.** A second, worse copy
 * of the statute living in a ranker is how the two drift apart, and the drift
 * would be invisible. What the ranking does is order paths by how *promising*
 * they look structurally: an anchor found, a good place string, a real date.
 * Then the caller runs the actual engine over the best few, which turns the
 * suggestion from a guess into a preview of what each line currently yields.
 */

import { resolvePlace } from "@/lib/c3/dates";
import { birthDateOf, birthPlaceOf, parentsOf } from "./parse";
import type { GedcomFile, GedcomIndividual } from "./parse";
import { guessBirthRegion } from "./places";

export type PathStep = {
  xref: string;
  /** How this person is reached from the one below: through mother or father. */
  via: "mother" | "father" | "self";
};

export type AncestralPath = {
  /** Anchor first, the person the search started from last. Engine order. */
  steps: PathStep[];
  /** True when the earliest person looks like they were born in Canada. */
  reachesAnchor: boolean;
  score: number;
  /** Why it scored what it did, so a suggestion can explain itself. */
  notes: string[];
};

export type PathLimits = {
  /** Generations above the starting person. Twenty is far past anything useful. */
  maxDepth?: number;
  /** Paths returned. Keeps a wide tree from producing thousands. */
  maxPaths?: number;
};

const DEFAULTS = { maxDepth: 20, maxPaths: 200 };

/**
 * Every distinct line upwards from `fromXref`.
 *
 * A branch stops at an anchor, at a person with no recorded parents, at the
 * depth limit, or at a cycle. Cycles are not hypothetical: a file where someone
 * has been recorded as their own ancestor by mistake is rare but real, and
 * without the check the walk never returns.
 */
export function ancestralPaths(
  file: GedcomFile,
  fromXref: string,
  limits: PathLimits = {},
): AncestralPath[] {
  const maxDepth = limits.maxDepth ?? DEFAULTS.maxDepth;
  const maxPaths = limits.maxPaths ?? DEFAULTS.maxPaths;

  const start = file.individuals.get(fromXref);
  if (start === undefined) return [];

  const complete: AncestralPath[] = [];
  // Breadth first, so that when the path cap bites it takes the shorter lines
  // rather than whichever branch happened to be walked first.
  let frontier: PathStep[][] = [[{ xref: fromXref, via: "self" }]];

  for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: PathStep[][] = [];

    for (const path of frontier) {
      const head = path[path.length - 1];
      const person = file.individuals.get(head.xref);

      if (person !== undefined && isAnchor(person)) {
        complete.push(finish(file, path));
        continue;
      }

      const parents =
        depth === maxDepth
          ? []
          : parentsOf(file, head.xref).flatMap(({ father, mother }) => [
              ...(father === null ? [] : [{ xref: father, via: "father" as const }]),
              ...(mother === null ? [] : [{ xref: mother, via: "mother" as const }]),
            ]);

      const seen = new Set(path.map((step) => step.xref));
      const usable = parents.filter((parent) => !seen.has(parent.xref));

      if (usable.length === 0) {
        complete.push(finish(file, path));
        continue;
      }
      for (const parent of usable) next.push([...path, parent]);
    }

    frontier = next;
    if (complete.length >= maxPaths) break;
  }

  // Anything still in flight at the depth limit is a real line too, just an
  // unfinished one; dropping it would silently hide a deep tree.
  for (const path of frontier) complete.push(finish(file, path));

  return complete
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.steps.length - b.steps.length ||
        a.steps[0].xref.localeCompare(b.steps[0].xref),
    )
    .slice(0, maxPaths);
}

/**
 * Does this person look like the end of the search?
 *
 * "Looks like" is the operative phrase. It is a place-string guess made without
 * a date, so it decides only where to stop walking; the interview still asks.
 */
function isAnchor(person: GedcomIndividual): boolean {
  const place = birthPlaceOf(person);
  if (place === null) return false;
  const guess = guessBirthRegion(place.place);
  return guess.region === "canada" || guess.region === "newfoundland";
}

/**
 * Reverses a path into engine order and scores it.
 *
 * The weights are arbitrary but fixed, and the order they produce is what
 * matters rather than the numbers themselves. Deterministic throughout: no
 * clock, no randomness, and a lexicographic tie-break so the same file always
 * suggests the same lines in the same order.
 */
function finish(file: GedcomFile, path: PathStep[]): AncestralPath {
  const steps = [...path].reverse();
  const top = file.individuals.get(steps[0].xref);
  const notes: string[] = [];
  let score = 0;

  const place = top === undefined ? null : birthPlaceOf(top);
  const guess = place === null ? null : guessBirthRegion(place.place);
  const reachesAnchor =
    guess !== null && (guess.region === "canada" || guess.region === "newfoundland");

  if (reachesAnchor) {
    score += 1000;
    notes.push(
      `reaches ${top?.name ?? "an ancestor"}, whose birth your file places in ${place?.place}`,
    );
    if (guess?.confidence === "high") score += 200;
  }

  const anchorBirth = top === undefined ? null : birthDateOf(top);
  if (anchorBirth?.date.kind === "exact") {
    score += 100;
  } else if (anchorBirth?.date.kind === "approximate") {
    score += 40;
    notes.push("the earliest birth date is approximate");
  }
  if (anchorBirth?.from === "baptism") {
    notes.push("that date is a baptism rather than a birth");
  }

  const dated = steps.filter((step) => {
    const person = file.individuals.get(step.xref);
    return person !== undefined && birthDateOf(person) !== null;
  });
  if (dated.length === steps.length) {
    score += 50;
  } else {
    notes.push(
      `${steps.length - dated.length} of ${steps.length} people have no birth date in your file`,
    );
  }

  // A shorter line is less work and has fewer places to go wrong, so it wins a
  // tie against a longer one that looks equally good.
  score -= 10 * steps.length;

  return { steps, reachesAnchor, score, notes };
}

/**
 * What a place and a date resolve to once the Act is applied. Used by the
 * preview, never by the ranking.
 *
 * Returns the class rather than a boolean because "reaches an anchor" is not
 * one question but two. A pre-union Newfoundland birth is every bit as much an
 * anchor as an Ontario one, and it is a completely different anchor: it routes
 * to the (l)/(n)/(p)/(r) set keyed to 1 April 1949 instead of the
 * (k)/(m)/(o)/(q) set keyed to 1 January 1947. A suggestion that said only
 * "reaches Canada" would flatten the one distinction the user most needs to
 * check.
 */
export function anchorClassOf(
  placeText: string,
  birthDate: string,
): "canada" | "newfoundland" | null {
  const guess = guessBirthRegion(placeText);
  if (guess.region === null || guess.region === "outside") return null;
  const resolved = resolvePlace(guess.region, birthDate);
  return resolved === "abroad" ? null : resolved;
}
