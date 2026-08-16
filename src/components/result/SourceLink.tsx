/**
 * A citation, resolved from the id a trace line carries.
 *
 * `catalogue.test.ts` already guarantees every id cited by the rule table
 * resolves, so the fallback below is defensive only: a rule added without its
 * source should show a bare id rather than crash a results page.
 */

import { sourceById } from "@/lib/sources";

export function SourceLink({ sourceId }: { sourceId: string }) {
  const source = sourceById(sourceId);
  if (source === undefined) {
    return <span className="font-mono text-xs">{sourceId}</span>;
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:text-foreground"
    >
      {source.title}, {source.citation}
    </a>
  );
}
