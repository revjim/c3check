/**
 * Test chains.
 *
 * **Every chain here is synthetic.** This repository is public. The dates and
 * places are invented; what is reproduced from the public sources is the
 * *shape* of a chain and the paragraph cascade it should produce, never a real
 * person's data. `.gitignore` blocks `*.ged`, `/reference/`, `/private/` and
 * `*.local.ts` so a real chain cannot be committed by accident; put one in a
 * `*.local.ts` file if you need it to debug.
 *
 * The first fixture is the important one. It reproduces the k -> o -> q -> q -> g
 * cascade from the GCMS notes published in the r/CanadianbyDescent thread,
 * already public, already anonymous, and the only end-to-end check against a
 * known-correct IRCC classification that exists.
 */

import type { Person } from "./types";

/**
 * The published GCMS chain: k -> o -> q -> q -> g.
 *
 * G0 is born in Canada before 1947 and naturalises in another country, which is
 * what makes them a (k) rather than simply a citizen in 1947. G1, born abroad
 * before 1947 to that (k), is an (o), and also a (q) on IRCC's own reading of
 * the parent test, which is where the (o)-over-(q) tie-break earns its keep.
 * G2 and G3 are consecutive (q)s. G4, born abroad before 1977 to a parent who
 * was by then a citizen effective 1947, is a (g).
 */
export const gcmsChain: Person[] = [
  {
    id: "g0",
    label: "G0",
    birthDate: "1870-03-02",
    birthRegion: "canada",
    deathDate: "1946-08-14",
    facts: { ceasedBritishSubject: true },
  },
  {
    id: "g1",
    label: "G1",
    birthDate: "1898-06-15",
    birthRegion: "outside",
    deathDate: "1967-05-04",
  },
  { id: "g2", label: "G2", birthDate: "1921-09-30", birthRegion: "outside" },
  { id: "g3", label: "G3", birthDate: "1944-02-11", birthRegion: "outside" },
  { id: "g4", label: "G4", birthDate: "1970-08-08", birthRegion: "outside" },
];

/**
 * The female-anchor variant from the same thread: a woman born in Canada who
 * lost British subject status on marrying a man who was not one. The cascade is
 * identical; the fact that produces the (k) is different, not the paragraph.
 *
 * A caveat the engine does not model: under the nationality law of the day,
 * British subject status passed through the paternal line and only within a
 * legitimate marriage. Whether her children were British subjects at birth is a
 * separate question this tool does not ask, and it can matter.
 */
export const femaleAnchorChain: Person[] = [
  {
    id: "g0",
    label: "G0",
    birthDate: "1875-11-19",
    birthRegion: "canada",
    deathDate: "1951-02-28",
    // Marriage to a man who was not a British subject, in 1901.
    facts: { ceasedBritishSubject: true },
  },
  {
    id: "g1",
    label: "G1",
    birthDate: "1903-04-07",
    birthRegion: "outside",
    deathDate: "1980-01-15",
  },
  { id: "g2", label: "G2", birthDate: "1928-12-02", birthRegion: "outside" },
  { id: "g3", label: "G3", birthDate: "1946-07-21", birthRegion: "outside" },
  { id: "g4", label: "G4", birthDate: "1972-03-30", birthRegion: "outside" },
];

/**
 * A modern anchor. An ancestor born in Canada in 1960 is a **(d)**, "was a
 * citizen immediately before February 15, 1977", not a (k). The (k) track
 * exists only for people born before 1947 who *lost* British subject status.
 * This chain guards the bug where "born in Canada" is read as "(k)".
 */
export const modernAnchorChain: Person[] = [
  { id: "g0", label: "G0", birthDate: "1960-05-04", birthRegion: "canada" },
  { id: "g1", label: "G1", birthDate: "1990-01-20", birthRegion: "outside" },
];

/**
 * An (m)-and-(o) overlap. G1 is born abroad before 1947 to a (k) parent, and was
 * also a British subject ordinarily resident in Canada on 1 January 1947 without
 * Canadian domicile. Both paragraphs describe them; 3(6.3) resolves it to (o).
 */
export const overlapChain: Person[] = [
  {
    id: "g0",
    label: "G0",
    birthDate: "1880-01-08",
    birthRegion: "canada",
    deathDate: "1955-06-30",
    facts: { ceasedBritishSubject: true },
  },
  {
    id: "g1",
    label: "G1",
    birthDate: "1910-10-10",
    birthRegion: "outside",
    deathDate: "1988-09-09",
    facts: {
      livedInCanadaOrNewfoundland: true,
      britishSubjectOnPivot: true,
      ordinarilyResidentOnPivot: true,
      canadianDomicileOnPivot: false,
      naturalizedInCanada: false,
    },
  },
];

/**
 * Newfoundland before the union: born there in 1930, lost British subject
 * status, so an (l) effective 1 April 1949. The child born abroad in 1940 is a
 * (p). Neither is a (k) or an (o); before the union Newfoundland was not
 * Canada, and the Act keeps an entirely separate set of paragraphs for it.
 */
export const newfoundlandBeforeUnionChain: Person[] = [
  {
    id: "g0",
    label: "G0",
    birthDate: "1930-02-14",
    birthRegion: "newfoundland",
    deathDate: "1990-04-04",
    facts: { ceasedBritishSubject: true },
  },
  {
    id: "g1",
    label: "G1",
    birthDate: "1940-06-06",
    birthRegion: "outside",
    deathDate: "2001-08-08",
  },
];

/**
 * The same place, the other side of the line. Born in Newfoundland in 1955,
 * after the union, so born in Canada: a (d), with no (l) or (n) in sight.
 */
export const newfoundlandAfterUnionChain: Person[] = [
  { id: "g0", label: "G0", birthDate: "1955-03-03", birthRegion: "newfoundland" },
  { id: "g1", label: "G1", birthDate: "1985-07-07", birthRegion: "outside" },
];

/**
 * A post-C-3 birth abroad in the second generation, the only situation in which
 * subsection 3(3) still bites. Pass the parent's physical-presence days, or
 * Crown service, through `facts` on the applicant.
 */
export function postCifChain(applicantFacts: Person["facts"] = {}): Person[] {
  return [
    { id: "g0", label: "G0", birthDate: "1960-05-04", birthRegion: "canada" },
    { id: "g1", label: "G1", birthDate: "1990-01-20", birthRegion: "outside" },
    {
      id: "g2",
      label: "G2",
      birthDate: "2030-04-01",
      birthRegion: "outside",
      facts: applicantFacts,
    },
  ];
}

/** An anchor whose loss of British subject status has not been established. */
export const unaskedAnchorChain: Person[] = [
  { id: "g0", label: "G0", birthDate: "1900-09-09", birthRegion: "canada" },
  { id: "g1", label: "G1", birthDate: "1930-03-03", birthRegion: "outside" },
];

/** Replaces one person's facts, leaving the rest of the chain alone. */
export function withFacts(
  chain: Person[],
  id: string,
  facts: Person["facts"],
): Person[] {
  return chain.map((person) =>
    person.id === id
      ? { ...person, facts: { ...person.facts, ...facts } }
      : person,
  );
}
