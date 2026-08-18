"use client";

/**
 * The whole line, in one table.
 *
 * The report is long on purpose, and it used to go straight from the headline
 * into prose cards, which leaves an officer or a lawyer nothing to scan. This is
 * the compact view: one row per generation, the paragraph, the date, and the
 * reason, with no generations compiled together and nothing truncated.
 *
 * A real `<table>`, unlike `PersonCard`, and the two are not in competition: a
 * card carries twelve fields and takes `break-inside: avoid` so a printed
 * generation is never split across a page; four columns of the same data is a
 * different job. The `overflow-x-auto` wrapper is what keeps it honest on a
 * phone: the table scrolls inside its own box rather than making the whole page
 * scroll sideways.
 *
 * Every cell comes from `chainRows` in `src/lib/report.ts`, which the markdown
 * export renders too. Two hand-written versions of the same four columns would
 * disagree with each other by the second change to either.
 *
 * Not shown: the engine's ORG ID, which `PersonCard` surfaces with the criteria
 * IRCC records against it. It needs that context to mean anything.
 */

import type { ChainResult } from "@/lib/c3";
import { chainRows } from "@/lib/report";

export function ChainTable({ result }: { result: ChainResult }) {
  const rows = chainRows(result);

  return (
    <section aria-labelledby="chain" className="mt-12">
      <h2 id="chain" className="text-lg font-semibold tracking-tight">
        The full chain as an officer will write it up
      </h2>
      <p className="mt-2 leading-7 text-muted">
        Every generation you entered, earliest first, with the paragraph that
        applies to each and when their citizenship took effect. G0 is the
        earliest generation in the line.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <Th>Person</Th>
              <Th>Paragraph</Th>
              <Th>Citizen as of</Th>
              <Th>Why</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.personId}
                className="break-inside-avoid border-b border-border last:border-b-0 align-top"
              >
                <Td>
                  <span className="font-medium">{row.person}</span>
                  {row.isApplicant ? (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      you
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span
                    className={
                      row.paragraphIsProvision
                        ? "font-mono whitespace-nowrap"
                        : "text-muted"
                    }
                  >
                    {row.paragraph}
                  </span>
                </Td>
                <Td>{row.citizenAsOf}</Td>
                <Td>
                  <span className="text-muted">{row.why}</span>
                  {row.note === null ? null : (
                    <span className="mt-1 block text-xs text-subtle">
                      {row.note}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-subtle"
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 leading-6">{children}</td>;
}
