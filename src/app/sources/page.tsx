import type { Metadata } from "next";
import { ACT_AS_OF, SOURCES, SOURCES_BY_KIND } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "The legislation, case law, and IRCC guidance that c3check's classification rules are built from.",
};

export default function SourcesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Sources</h1>
      <p className="mt-4 text-muted">
        Every rule this tool applies traces back to one of the documents below.
        Classification rules are encoded against the <em>Citizenship Act</em> as
        amended {ACT_AS_OF}.
      </p>

      {SOURCES_BY_KIND.map(({ kind, label }) => {
        const items = SOURCES.filter((s) => s.kind === kind);
        if (items.length === 0) return null;

        return (
          <section key={kind} className="mt-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle">
              {label}
            </h2>
            <ul className="mt-4 space-y-8">
              {items.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-current"
                  >
                    {s.title}
                  </a>
                  <p className="mt-1 text-sm text-subtle">
                    {s.citation}
                    {s.inForce ? ` · ${s.inForce}` : ""}
                  </p>
                  {s.note ? (
                    <p className="mt-2 text-sm leading-6 text-muted">{s.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

    </div>
  );
}
