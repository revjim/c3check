/**
 * The saved interview, as data.
 *
 * Pure: types, reducers, migration, and the conversion into the shape the
 * classifier wants. Nothing here touches `window`, `localStorage` or the clock;
 * that is `draftStore.ts`, and the split is what keeps this module testable in
 * the node environment the rest of the suite runs in.
 *
 * **`people` is stored oldest first**, which is the order `classifyChain` wants,
 * so `chainFrom` is a straight map with no reversal anywhere. The interview
 * walks backwards through it, but that is a rendering concern: adding a
 * generation is an `unshift`, and because labels derive from position rather
 * than being written down at the time, an unshift needs no relabelling pass.
 *
 * **The applicant is named, not positional.** A line is "a chain that contains
 * you", not "your ancestors": once the backward walk reaches an anchor the same
 * chain can be extended *forward* into children and grandchildren, and the
 * engine already classifies them correctly, because it only ever looks at the
 * entry before each person. What it cannot do is guess who the answer is about,
 * and "the last entry" stops meaning "you" the moment a child is appended. So
 * `applicantId` is stored, for the same reason `StepRef` stores ids rather than
 * ordinals: positions shift as the line grows, and a meaning built on one rots.
 */

import { classifyChain } from "@/lib/c3";
import { isValidCalendarDate, resolvePlace } from "@/lib/c3/dates";
import { FACTS } from "@/lib/c3/facts";
import type {
  BirthRegion,
  ChainResult,
  FactId,
  Person,
  PersonFacts,
} from "@/lib/c3";

/**
 * The shape of the saved JSON.
 *
 * Lives inside the document rather than in the storage key. `CONSENT_KEY` is
 * key-versioned because bumping it *should* re-prompt everyone; bumping
 * `DRAFT_KEY` would silently orphan a half-finished six-generation line. See
 * the note beside both constants in `site.ts`.
 *
 * **Bumping this is not free.** `migrateDraft` compared the stored version to
 * this constant for equality and returned an empty draft on any mismatch, so
 * raising the number without teaching it the old shape would discard every
 * draft anyone has in progress, silently, on the deploy. `READABLE_VERSIONS` is
 * the list it actually accepts, and `draft.test.ts` feeds a version 1 document
 * through to keep that trap from reopening.
 *
 * 1 -> 2 added `applicantId` and `noLaterDescendant`.
 */
export const DRAFT_VERSION = 2;

/**
 * Every version this build can read. A document at an older version is upgraded
 * by `migrateLine`, which defaults each field the older shape lacked.
 */
const READABLE_VERSIONS: number[] = [1, DRAFT_VERSION];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonSource = "entered" | "gedcom";

/** What a GEDCOM file suggested, and whether the user has looked at it yet. */
export type GedcomOrigin = {
  xref: string;
  /** The `PLAC` string verbatim, so the screen can show what it was read from. */
  placeText?: string;
  /** The `DATE` string verbatim, including any `ABT` or `BET` qualifier. */
  dateText?: string;
  /**
   * False until the person screen has been visited and submitted. A prefill is
   * never treated as an answer: a `PLAC` is whatever a relative typed decades
   * later, and `resolvePlace` needs the legal status of a place at a date.
   */
  confirmed: boolean;
};

export type PersonDraft = {
  /** "p1", "p2". Stable for the life of the line, including across an unshift. */
  id: string;
  /** What the user calls them, or null to derive one from position. */
  label: string | null;
  /** "" until a valid calendar date is entered; never handed to `isoDate`. */
  birthDate: string;
  /** The year is known and the rest was filled in. Drives the boundary warning. */
  birthDateApproximate: boolean;
  birthRegion: BirthRegion | null;
  /** Null means the question has not been put yet, which is not the same as "no". */
  living: boolean | null;
  /** Null where they died and the date is not known, as well as where they did not. */
  deathDate: string | null;
  facts: PersonFacts;
  /**
   * Facts the question has actually been put for, which is not the same as
   * facts with a value: answering "I do not know yet" records the fact here and
   * removes the value. Without that distinction the interview would ask an
   * unanswerable question on every pass, because the fact stays in
   * `result.missing` forever. The results page still lists it under what is
   * unknown, with a control to come back to it.
   */
  answered: FactId[];
  /**
   * Assumptions the confirm pass offered and the user chose to leave standing.
   * Deliberately does *not* set the fact: the engine goes on reporting it
   * honestly as an assumption, and the results page badges it "you confirmed
   * this" rather than "we assumed this". It is also what makes the confirm pass
   * terminate; see `interview.ts`.
   */
  acceptedDefaults: FactId[];
  source: PersonSource;
  gedcom?: GedcomOrigin;
};

/**
 * A place in the interview. Distinct from `interview.ts`'s `Step` because a
 * `StepRef` is stored: it is what "change this answer" on the results page
 * writes down, and it must survive a reload.
 */
export type StepRef =
  | { kind: "person"; personId: string }
  | { kind: "fact"; personId: string; factId: FactId }
  /** Per person, not per fact; see the note on the confirm pass in `interview.ts`. */
  | { kind: "confirm"; personId: string }
  | { kind: "add-ancestor"; childId: string }
  | { kind: "add-descendant"; parentId: string };

export type LineDraft = {
  id: string;
  /** "Mother's line". Shown on /check/lines and at the head of the report. */
  name: string;
  /** Oldest first: engine order, no reversal anywhere. */
  people: PersonDraft[];
  /**
   * Who the answer is about. Usually the last entry, and not once a child has
   * been added; see the note at the head of this file.
   */
  applicantId: string;
  nextPersonSeq: number;
  /** Set by "change this answer"; consumed by `nextStep`. */
  pendingEdit: StepRef | null;
  /** "I do not know who their parent was". Ends the line without an anchor. */
  noEarlierAncestor: boolean;
  /** "There is no one after them". Stops the interview offering a child. */
  noLaterDescendant: boolean;
  forkedFrom?: { lineId: string; atPersonId: string };
  /** Stamped by the store. A pure reducer never sets this. */
  updatedAt: number;
};

export type Draft = {
  version: typeof DRAFT_VERSION;
  lines: LineDraft[];
  currentLineId: string | null;
};

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function emptyDraft(): Draft {
  return { version: DRAFT_VERSION, lines: [], currentLineId: null };
}

export function newPerson(id: string, source: PersonSource = "entered"): PersonDraft {
  return {
    id,
    label: null,
    birthDate: "",
    birthDateApproximate: false,
    birthRegion: null,
    living: null,
    deathDate: null,
    facts: {},
    answered: [],
    acceptedDefaults: [],
    source,
  };
}

/** A line containing just the applicant, ready for the first person screen. */
export function newLine(id: string, name: string): LineDraft {
  return {
    id,
    name,
    people: [newPerson("p1")],
    applicantId: "p1",
    nextPersonSeq: 2,
    pendingEdit: null,
    noEarlierAncestor: false,
    noLaterDescendant: false,
    updatedAt: 0,
  };
}

/**
 * The next unused line id. Derived from the ids in use rather than from a
 * counter or a clock, so that every reducer stays a pure function of its input
 * and the same draft always produces the same next id.
 */
export function nextLineId(draft: Draft): string {
  let highest = 0;
  for (const line of draft.lines) {
    const match = /^l(\d+)$/.exec(line.id);
    if (match !== null) highest = Math.max(highest, Number(match[1]));
  }
  return `l${highest + 1}`;
}

export function addLine(draft: Draft, name: string): Draft {
  const line = newLine(nextLineId(draft), name);
  return { ...draft, lines: [...draft.lines, line], currentLineId: line.id };
}

// ---------------------------------------------------------------------------
// Reading a line
// ---------------------------------------------------------------------------

export function lineById(draft: Draft, id: string | null): LineDraft | null {
  if (id === null) return null;
  return draft.lines.find((line) => line.id === id) ?? null;
}

export function currentLine(draft: Draft): LineDraft | null {
  return lineById(draft, draft.currentLineId);
}

/**
 * Where the applicant sits in the line.
 *
 * Falls back to the last entry, which is both the pre-v2 meaning and the only
 * sane guess: a stored `applicantId` naming somebody who is no longer in the
 * line would otherwise index off the end and take the report with it.
 * `migrateLine` already refuses such an id, so this is the second line of
 * defence, for a line assembled in code rather than read from storage.
 */
export function applicantIndexOf(line: LineDraft): number {
  const index = line.people.findIndex(
    (person) => person.id === line.applicantId,
  );
  return index === -1 ? line.people.length - 1 : index;
}

/** The person the answer is about. */
export function applicantOf(line: LineDraft): PersonDraft | null {
  return line.people[applicantIndexOf(line)] ?? null;
}

/** The earliest generation entered, which is not necessarily an anchor yet. */
export function anchorOf(line: LineDraft): PersonDraft | null {
  return line.people[0] ?? null;
}

export function personById(line: LineDraft, id: string): PersonDraft | null {
  return line.people.find((person) => person.id === id) ?? null;
}

/** The entry before this one, which is this person's parent. */
export function parentOf(line: LineDraft, personId: string): PersonDraft | null {
  const index = line.people.findIndex((person) => person.id === personId);
  return index > 0 ? line.people[index - 1] : null;
}

/**
 * 0 for the applicant, 1 for their parent, and so on.
 *
 * **Negative for a descendant**: -1 is the applicant's child. Every caller has
 * to handle that, and `defaultLabel` is the one that would otherwise fail
 * quietly rather than loudly; see the note there.
 */
export function generationsBack(line: LineDraft, personId: string): number {
  const index = line.people.findIndex((person) => person.id === personId);
  return index === -1 ? 0 : applicantIndexOf(line) - index;
}

/**
 * Which parent an ancestor is.
 *
 * Purely a labelling and forking affordance. **The engine does not model sex at
 * all**, so do not go looking for it in `PersonFacts`: no paragraph of s. 3(1)
 * turns on it. The one place it historically mattered, a woman who ceased to be
 * a British subject on marrying a man who was not one, is captured by
 * `ceasedBritishSubject` rather than by her sex. This exists so that a line
 * reads "your grandmother" instead of "your grandparent", and so that the fork
 * can say "try your grandfather's line instead".
 */
export type ParentKind = "parent" | "mother" | "father";

const RELATION: Record<ParentKind, string> = {
  parent: "parent",
  mother: "mother",
  father: "father",
};

const GRAND: Record<ParentKind, string> = {
  parent: "grandparent",
  mother: "grandmother",
  father: "grandfather",
};

/**
 * What to call a generation.
 *
 * The applicant is "The applicant" and not "You", which looks wrong until you
 * see where the string ends up. Every sentence the engine builds is in the third
 * person, "`${label}` is a citizen under paragraph 3(1)(g)", so a label of "You"
 * produces "You is a citizen" on the headline of the finished report. Questions
 * addressed to the person filling the form want the second person instead, and
 * that is `addressOf`.
 *
 * **The negative cases are load-bearing.** `back` goes below zero for a
 * descendant, and the `default` arm catches any number it is not given a case
 * for, so without them a grandchild renders as "Your -2x-great-grandparent" on
 * a report somebody is about to act on: wrong, and wrong in a way that looks
 * like a rendering bug rather than announcing itself. They are the only thing
 * standing between a descendant and nonsense.
 *
 * There is no `ChildKind` mirroring `ParentKind`. Mother and father exist so a
 * line can fork into two parental lines and so a row reads "your grandmother";
 * a child has no equivalent need, and anybody who wants a name types one on the
 * identity screen.
 */
export function defaultLabel(back: number, kind: ParentKind = "parent"): string {
  switch (back) {
    case 0:
      return "The applicant";
    case 1:
      return `Your ${RELATION[kind]}`;
    case 2:
      return `Your ${GRAND[kind]}`;
    case 3:
      return `Your great-${GRAND[kind]}`;
    case 4:
      return `Your great-great-${GRAND[kind]}`;
    case -1:
      return "Your child";
    case -2:
      return "Your grandchild";
    case -3:
      return "Your great-grandchild";
    default:
      // Past here the chain of "great"s stops being readable and starts being
      // a counting exercise for the reader.
      return back < 0
        ? `Your ${-back - 2}x-great-grandchild`
        : `Your ${back - 2}x-great-${GRAND[kind]}`;
  }
}

/** What to call this person in the report, and in everything the engine writes. */
export function labelOf(line: LineDraft, person: PersonDraft): string {
  const named = person.label?.trim();
  if (named !== undefined && named.length > 0) return named;
  return defaultLabel(generationsBack(line, person.id));
}

/**
 * The same person, addressed rather than described.
 *
 * The interview is a conversation with one particular reader, so a question
 * about them should say "did you" and not "did the applicant". Everything else,
 * including every ancestor, reads the same either way.
 */
export function addressOf(line: LineDraft, person: PersonDraft): string {
  const named = person.label?.trim();
  if (named !== undefined && named.length > 0) return named;
  return generationsBack(line, person.id) === 0
    ? "you"
    : defaultLabel(generationsBack(line, person.id));
}

/**
 * A label with its capital dropped, for use part way through a sentence.
 *
 * Only touches the labels this file generates. A name somebody typed keeps its
 * capital, which is why this matches the two generated forms rather than simply
 * lowercasing the first letter: "Who was Alice's parent?" is right and "Who was
 * alice's parent?" is not.
 */
export function midSentence(label: string): string {
  if (label === "The applicant") return "the applicant";
  if (label.startsWith("Your ")) return `your ${label.slice(5)}`;
  return label;
}

/**
 * The inverse, for a label that stands on its own rather than inside a
 * sentence: a heading, or a row in the trail of answered questions.
 *
 * Only "you" needs the treatment. Everything else `addressOf` returns is either
 * already capitalised, because `defaultLabel` wrote it, or a name somebody
 * typed, which is theirs to capitalise as they like.
 */
export function sentenceStart(label: string): string {
  return label === "you" ? "You" : label;
}

// ---------------------------------------------------------------------------
// Completeness and conversion
// ---------------------------------------------------------------------------

/**
 * Whether this person's identity is settled enough to hand to the engine.
 *
 * A GEDCOM prefill does not count until the person screen has been visited: the
 * file supplies a starting point, never an answer.
 */
export function isCompletePerson(person: PersonDraft): boolean {
  if (!isValidCalendarDate(person.birthDate)) return false;
  if (person.birthRegion === null) return false;
  if (person.living === null) return false;
  if (person.deathDate !== null && !isValidCalendarDate(person.deathDate)) {
    return false;
  }
  if (person.gedcom !== undefined && !person.gedcom.confirmed) return false;
  return true;
}

export function isCompleteLine(line: LineDraft): boolean {
  return line.people.length > 0 && line.people.every(isCompletePerson);
}

/**
 * The line as the engine wants it, or null if anything is still missing.
 *
 * Returning null rather than a partial chain is the point: `classifyChain`
 * throws on an empty array and `isoDate` throws on a half-typed date, and a
 * results page is a bad place to find that out.
 */
export function chainFrom(line: LineDraft): Person[] | null {
  if (!isCompleteLine(line)) return null;
  return line.people.map((person) => ({
    id: person.id,
    label: labelOf(line, person),
    birthDate: person.birthDate,
    birthRegion: person.birthRegion as BirthRegion,
    ...(person.deathDate !== null ? { deathDate: person.deathDate } : {}),
    facts: person.facts,
  }));
}

/**
 * Classifies a line, or returns null where there is not yet enough to classify.
 *
 * `assessAssumptions` is left to the caller and matters: the default re-runs
 * the whole chain once per boolean assumption, which is right for the confirm
 * pass and the results page and wasteful on every interview keystroke.
 */
export function classifyLine(
  line: LineDraft,
  options: { assessAssumptions?: boolean } = {},
): ChainResult | null {
  const chain = chainFrom(line);
  if (chain === null) return null;
  return classifyChain(chain, {
    ...options,
    applicantIndex: applicantIndexOf(line),
  });
}

/**
 * Whether the interview should offer to add another generation.
 *
 * Deliberately **not** driven off `headline.verdict === "incomplete"`. That
 * verdict comes from `lacksAnchor`, which requires every person in the line to
 * have failed; one `undetermined` person anywhere makes the verdict
 * `undetermined` instead, and the offer to add a generation would vanish at
 * exactly the moment it is most needed. This mirrors the structural condition
 * instead: is the topmost person an anchor, and if not, has the line resolved
 * anyway?
 */
export function needsAncestor(line: LineDraft): boolean {
  const top = anchorOf(line);
  if (top === null || top.birthRegion === null) return false;
  // Identity gaps anywhere are asked before this, so an incomplete line here
  // means the caller is out of order rather than that a generation is missing.
  if (!isCompleteLine(line)) return false;
  if (line.noEarlierAncestor) return false;
  if (resolvePlace(top.birthRegion, top.birthDate) !== "abroad") return false;
  if (top.facts.naturalizedInCanada === true) return false;
  const result = classifyLine(line, { assessAssumptions: false });
  return result === null || result.statuses[0].outcome !== "qualifies";
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

function mapPeople(
  line: LineDraft,
  personId: string,
  change: (person: PersonDraft) => PersonDraft,
): LineDraft {
  return {
    ...line,
    people: line.people.map((person) =>
      person.id === personId ? change(person) : person,
    ),
  };
}

/**
 * Adds an empty generation above the current earliest one.
 *
 * A stated mother or father is written down as a label rather than derived,
 * because `defaultLabel` only knows the position. Storing it is safe: an
 * unshift raises every index and the length together, so `generationsBack` for
 * everyone already in the line is unchanged and the label cannot go stale.
 */
export function addAncestor(
  line: LineDraft,
  kind: ParentKind = "parent",
): LineDraft {
  const person = newPerson(`p${line.nextPersonSeq}`);
  // One further back than the person currently at the top, counted from the
  // applicant rather than from the end of the array, which are the same number
  // only until a descendant is added.
  const back = applicantIndexOf(line) + 1;
  return {
    ...line,
    people: [
      kind === "parent"
        ? person
        : { ...person, label: defaultLabel(back, kind) },
      ...line.people,
    ],
    nextPersonSeq: line.nextPersonSeq + 1,
    noEarlierAncestor: false,
  };
}

/**
 * Adds an empty generation below the current youngest one.
 *
 * The mirror of `addAncestor`, and simpler: a push cannot move anybody's index,
 * so nothing needs relabelling and there is no `ChildKind` to write down. The
 * engine needs no teaching either. `classifyPerson` reads each person's parent
 * as the entry before them, and `presenceDaysInCanada` in the fact catalogue is
 * already Bill C-3's substantial-connection test, which only ever bites on a
 * child born abroad to a first-generation-abroad parent. The rules for
 * descendants were written before there was any way to enter one.
 *
 * `applicantId` is deliberately left alone. The answer is still about the person
 * who started the interview, and the new row is a further question rather than a
 * new subject; see the decision note in `interview.ts`.
 */
export function addDescendant(line: LineDraft): LineDraft {
  return {
    ...line,
    people: [...line.people, newPerson(`p${line.nextPersonSeq}`)],
    nextPersonSeq: line.nextPersonSeq + 1,
    noLaterDescendant: false,
  };
}

export function updatePerson(
  line: LineDraft,
  personId: string,
  patch: Partial<PersonDraft>,
): LineDraft {
  return mapPeople(line, personId, (person) => {
    const next = { ...person, ...patch };
    // Someone recorded as living cannot also have a date of death; keeping both
    // would let a stale date decide a paragraph after the answer was corrected.
    if (next.living === true) next.deathDate = null;
    return next;
  });
}

/** Records an answer. The fact is set and the question is marked as put. */
export function setFact(
  line: LineDraft,
  personId: string,
  factId: FactId,
  value: boolean | number,
): LineDraft {
  return mapPeople(line, personId, (person) => ({
    ...person,
    facts: { ...person.facts, [factId]: value },
    answered: person.answered.includes(factId)
      ? person.answered
      : [...person.answered, factId],
    // An answer supersedes a decision to leave the assumption standing.
    acceptedDefaults: person.acceptedDefaults.filter((id) => id !== factId),
  }));
}

/**
 * "I do not know yet."
 *
 * Removes the value but keeps the fact in `answered`, so the engine goes back
 * to reporting the person as undetermined (the honest state) while the
 * interview stops putting a question the user has already declined. It stays on
 * the results page under what is still unknown, with the documents that would
 * settle it.
 */
export function clearFact(
  line: LineDraft,
  personId: string,
  factId: FactId,
): LineDraft {
  return mapPeople(line, personId, (person) => {
    const facts = { ...person.facts };
    delete facts[factId];
    return {
      ...person,
      facts,
      answered: person.answered.includes(factId)
        ? person.answered
        : [...person.answered, factId],
    };
  });
}

/**
 * "No, that assumption is right."
 *
 * Records the decision without setting the fact, so the result still says
 * plainly that it was assumed rather than established.
 */
export function acceptDefault(
  line: LineDraft,
  personId: string,
  factId: FactId,
): LineDraft {
  return mapPeople(line, personId, (person) =>
    person.acceptedDefaults.includes(factId)
      ? person
      : { ...person, acceptedDefaults: [...person.acceptedDefaults, factId] },
  );
}

/** Marks a GEDCOM prefill as looked at, which is what makes the person complete. */
export function confirmGedcom(line: LineDraft, personId: string): LineDraft {
  return mapPeople(line, personId, (person) =>
    person.gedcom === undefined
      ? person
      : { ...person, gedcom: { ...person.gedcom, confirmed: true } },
  );
}

export function setPendingEdit(line: LineDraft, ref: StepRef | null): LineDraft {
  return { ...line, pendingEdit: ref };
}

export function setNoEarlierAncestor(line: LineDraft, value: boolean): LineDraft {
  return { ...line, noEarlierAncestor: value };
}

export function setNoLaterDescendant(line: LineDraft, value: boolean): LineDraft {
  return { ...line, noLaterDescendant: value };
}

export function replaceLine(draft: Draft, line: LineDraft): Draft {
  return {
    ...draft,
    lines: draft.lines.map((existing) =>
      existing.id === line.id ? line : existing,
    ),
  };
}

export function renameLine(draft: Draft, lineId: string, name: string): Draft {
  return {
    ...draft,
    lines: draft.lines.map((line) =>
      line.id === lineId ? { ...line, name } : line,
    ),
  };
}

export function deleteLine(draft: Draft, lineId: string): Draft {
  const lines = draft.lines.filter((line) => line.id !== lineId);
  const currentLineId =
    draft.currentLineId === lineId
      ? (lines[lines.length - 1]?.id ?? null)
      : draft.currentLineId;
  return { ...draft, lines, currentLineId };
}

export function setCurrentLine(draft: Draft, lineId: string | null): Draft {
  return { ...draft, currentLineId: lineId };
}

/**
 * "Try the other parent's line."
 *
 * Keeps the fork point and everyone descended from them, and drops everything
 * above: those are the ancestors reached through the parent being swapped out.
 * The new line is left one generation short on purpose, so the interview picks
 * up at "who was this person's parent?" with the other parent to hand.
 *
 * The original is not touched. Someone comparing two lines needs both.
 */
export function forkLine(
  draft: Draft,
  lineId: string,
  atPersonId: string,
  name: string,
): { draft: Draft; lineId: string } | null {
  const source = lineById(draft, lineId);
  if (source === null) return null;
  const index = source.people.findIndex((person) => person.id === atPersonId);
  if (index === -1) return null;

  const id = nextLineId(draft);
  const people = source.people.slice(index).map((person) => ({
    ...person,
    facts: { ...person.facts },
    answered: [...person.answered],
    acceptedDefaults: [...person.acceptedDefaults],
    ...(person.gedcom !== undefined ? { gedcom: { ...person.gedcom } } : {}),
  }));
  const line: LineDraft = {
    id,
    name,
    people,
    // Forking at a person below the applicant drops the applicant, which only
    // happens for a line that had descendants entered. The youngest person kept
    // is then the subject of the new line, which is the same rule the interview
    // started from.
    applicantId: people.some((person) => person.id === source.applicantId)
      ? source.applicantId
      : people[people.length - 1].id,
    nextPersonSeq: source.nextPersonSeq,
    pendingEdit: null,
    noEarlierAncestor: false,
    noLaterDescendant: source.noLaterDescendant,
    forkedFrom: { lineId, atPersonId },
    updatedAt: 0,
  };
  return {
    draft: { ...draft, lines: [...draft.lines, line], currentLineId: id },
    lineId: id,
  };
}

// ---------------------------------------------------------------------------
// Serialisation and migration
// ---------------------------------------------------------------------------

export function serializeDraft(draft: Draft): string {
  return JSON.stringify(draft);
}

/** Reads stored text into a draft. Never throws; unreadable text is no draft. */
export function parseDraft(text: string | null): Draft {
  if (text === null || text === "") return emptyDraft();
  try {
    return migrateDraft(JSON.parse(text));
  } catch {
    return emptyDraft();
  }
}

/**
 * Brings whatever is in storage up to the current shape.
 *
 * Never throws, and drops anything it does not recognise rather than trusting
 * it. Storage is user-writable and survives deploys, so this is the boundary
 * where a draft written by an older build, a different tab, or a fat-fingered
 * devtools edit stops being arbitrary JSON and starts being a `Draft`.
 * `/check/error.tsx` is the second line of defence, not the first.
 */
export function migrateDraft(raw: unknown): Draft {
  if (!isRecord(raw)) return emptyDraft();
  // Not `!== DRAFT_VERSION`. That is what this line used to say, and bumping the
  // constant beside it would then have thrown away every draft in progress.
  if (typeof raw.version !== "number") return emptyDraft();
  if (!READABLE_VERSIONS.includes(raw.version)) return emptyDraft();
  if (!Array.isArray(raw.lines)) return emptyDraft();

  const lines = raw.lines
    .map(migrateLine)
    .filter((line): line is LineDraft => line !== null);
  const currentLineId =
    typeof raw.currentLineId === "string" &&
    lines.some((line) => line.id === raw.currentLineId)
      ? raw.currentLineId
      : (lines[lines.length - 1]?.id ?? null);

  return { version: DRAFT_VERSION, lines, currentLineId };
}

/**
 * One line, validated and brought up to the current shape, or null.
 *
 * Exported because a markdown document carries a line rather than a whole draft
 * (see `src/lib/markdown.ts`), and that file is as user-writable as storage is:
 * hand-edited, saved by an older build, or truncated by a mail client. There is
 * exactly one validator for both paths, and it never throws.
 */
export function migrateLine(raw: unknown): LineDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (!Array.isArray(raw.people)) return null;

  const people = raw.people
    .map(migratePerson)
    .filter((person): person is PersonDraft => person !== null);
  if (people.length === 0) return null;

  const seq = typeof raw.nextPersonSeq === "number" ? raw.nextPersonSeq : 0;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "Your line",
    people,
    // A version 1 document has no `applicantId`: the applicant was defined
    // positionally as the last entry, so that is exactly what the upgrade is.
    // The same fallback catches an id naming somebody who has since been
    // dropped, which would otherwise index off the end of the chain.
    applicantId:
      typeof raw.applicantId === "string" &&
      people.some((person) => person.id === raw.applicantId)
        ? raw.applicantId
        : people[people.length - 1].id,
    // Never below what the people already use, or a later `addAncestor` would
    // mint an id that is already taken and two generations would merge.
    nextPersonSeq: Math.max(seq, highestPersonSeq(people) + 1),
    pendingEdit: migrateStepRef(raw.pendingEdit, people),
    noEarlierAncestor: raw.noEarlierAncestor === true,
    noLaterDescendant: raw.noLaterDescendant === true,
    ...(isRecord(raw.forkedFrom) &&
    typeof raw.forkedFrom.lineId === "string" &&
    typeof raw.forkedFrom.atPersonId === "string"
      ? {
          forkedFrom: {
            lineId: raw.forkedFrom.lineId,
            atPersonId: raw.forkedFrom.atPersonId,
          },
        }
      : {}),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
  };
}

function highestPersonSeq(people: PersonDraft[]): number {
  let highest = 0;
  for (const person of people) {
    const match = /^p(\d+)$/.exec(person.id);
    if (match !== null) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

function migratePerson(raw: unknown): PersonDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;

  return {
    id: raw.id,
    label: typeof raw.label === "string" ? raw.label : null,
    birthDate: typeof raw.birthDate === "string" ? raw.birthDate : "",
    birthDateApproximate: raw.birthDateApproximate === true,
    birthRegion: isBirthRegion(raw.birthRegion) ? raw.birthRegion : null,
    living: typeof raw.living === "boolean" ? raw.living : null,
    deathDate: typeof raw.deathDate === "string" ? raw.deathDate : null,
    facts: migrateFacts(raw.facts),
    answered: migrateFactIds(raw.answered),
    acceptedDefaults: migrateFactIds(raw.acceptedDefaults),
    source: raw.source === "gedcom" ? "gedcom" : "entered",
    ...(isRecord(raw.gedcom) && typeof raw.gedcom.xref === "string"
      ? {
          gedcom: {
            xref: raw.gedcom.xref,
            ...(typeof raw.gedcom.placeText === "string"
              ? { placeText: raw.gedcom.placeText }
              : {}),
            ...(typeof raw.gedcom.dateText === "string"
              ? { dateText: raw.gedcom.dateText }
              : {}),
            confirmed: raw.gedcom.confirmed === true,
          },
        }
      : {}),
  };
}

function migrateFacts(raw: unknown): PersonFacts {
  if (!isRecord(raw)) return {};
  const facts: PersonFacts = {};
  for (const id of factIds()) {
    const value = raw[id];
    // Booleans and numbers only. The engine's own `bool`/`num` readers already
    // ignore a value of the wrong kind, so a mistyped fact degrades to unasked
    // rather than deciding a paragraph.
    if (typeof value === "boolean" || Number.isFinite(value)) {
      Object.assign(facts, { [id]: value });
    }
  }
  return facts;
}

function migrateFactIds(raw: unknown): FactId[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<string>(factIds());
  return [...new Set(raw.filter((id): id is FactId => known.has(id as string)))];
}

function migrateStepRef(raw: unknown, people: PersonDraft[]): StepRef | null {
  if (!isRecord(raw)) return null;
  const known = new Set(people.map((person) => person.id));
  const factOf = (value: unknown): FactId | null =>
    typeof value === "string" && (factIds() as string[]).includes(value)
      ? (value as FactId)
      : null;

  switch (raw.kind) {
    case "person":
      return typeof raw.personId === "string" && known.has(raw.personId)
        ? { kind: "person", personId: raw.personId }
        : null;
    case "confirm":
      return typeof raw.personId === "string" && known.has(raw.personId)
        ? { kind: "confirm", personId: raw.personId }
        : null;
    case "fact": {
      const factId = factOf(raw.factId);
      return typeof raw.personId === "string" &&
        known.has(raw.personId) &&
        factId !== null
        ? { kind: "fact", personId: raw.personId, factId }
        : null;
    }
    case "add-ancestor":
      return typeof raw.childId === "string" && known.has(raw.childId)
        ? { kind: "add-ancestor", childId: raw.childId }
        : null;
    case "add-descendant":
      return typeof raw.parentId === "string" && known.has(raw.parentId)
        ? { kind: "add-descendant", parentId: raw.parentId }
        : null;
    default:
      return null;
  }
}

let cachedFactIds: FactId[] | null = null;
function factIds(): FactId[] {
  cachedFactIds ??= Object.keys(FACTS) as FactId[];
  return cachedFactIds;
}

function isBirthRegion(value: unknown): value is BirthRegion {
  return value === "canada" || value === "newfoundland" || value === "outside";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
