import Link from "next/link";
import { ACT_AS_OF } from "@/lib/sources";

const STEPS = [
  {
    title: "Start with yourself",
    body: "Your birth date and where you were born. Nothing else to begin with.",
  },
  {
    title: "Work back one generation at a time",
    body: "Your parent, then theirs. We stop as soon as we reach an ancestor born in Canada.",
  },
  {
    title: "Answer only what matters",
    body: "Most questions never get asked. You only see the ones that can change your answer, and each explains why it is being asked.",
  },
  {
    title: "Get a table you can act on",
    body: "Every relative, the paragraph that applies to them, when their citizenship took effect, and why — plus the documents to chase if something is still unknown.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Which paragraph applies to each generation of your family?
      </h1>

      <p className="mt-5 text-lg leading-8 text-muted">
        Canadian citizenship by descent is not simply a question of whether you
        descend from a Canadian. IRCC classifies{" "}
        <strong className="font-medium text-foreground">every generation</strong>{" "}
        under a specific paragraph of section 3 of the{" "}
        <em>Citizenship Act</em>, and each generation&rsquo;s answer depends on
        the one before it. c3check follows that chain and shows its reasoning at
        every step.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/check"
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Check a family line
        </Link>
        <Link
          href="/sources"
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          See the sources first
        </Link>
      </div>

      <p className="mt-4 text-sm text-subtle">
        Free. No account. Your family details never leave your browser.
      </p>

      <h2 className="mt-16 text-sm font-semibold uppercase tracking-widest text-subtle">
        How it works
      </h2>
      <ol className="mt-6 space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-medium text-muted ring-1 ring-border"
            >
              {i + 1}
            </span>
            <div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="mt-1 leading-7 text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-medium">Where this is uncertain, it says so</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Parts of the guidance behind these rules are withheld from public
          release, and IRCC has paused processing on some categories of claim.
          Where an answer turns on a point nobody can currently resolve,
          c3check flags the row rather than guessing. Rules are encoded against
          the <em>Citizenship Act</em> as amended {ACT_AS_OF}.
        </p>
      </div>
    </div>
  );
}
