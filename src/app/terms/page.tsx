import type { Metadata } from "next";
import Link from "next/link";
import { ISSUES_URL, POLICY_UPDATED } from "@/lib/site";
import { ACT_AS_OF } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "c3check is a free educational tool, not legal or immigration advice, and is not affiliated with IRCC or the Government of Canada.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Use</h1>
      <p className="mt-2 text-sm text-subtle">Last updated {POLICY_UPDATED}</p>

      <div className="mt-8 rounded-lg border border-brand/30 bg-brand/5 p-5">
        <p className="leading-7">
          <strong className="font-semibold">
            c3check is for educational purposes only. It is not legal advice and
            not immigration advice.
          </strong>{" "}
          It is not affiliated with, endorsed by, or connected to Immigration,
          Refugees and Citizenship Canada or the Government of Canada. By using
          this site you accept these terms.
        </p>
      </div>

      <Section title="What this tool does">
        <p>
          c3check applies the paragraphs of section 3 of the{" "}
          <em>Citizenship Act</em> to a family line you describe, and shows you
          which paragraph it thinks applies to each generation and why. It is a
          reading aid for a complicated statute. It is not a decision, an
          application, or an assessment of your eligibility.
        </p>
        <p>
          Only IRCC can decide whether you are a Canadian citizen. Nothing this
          site outputs binds IRCC in any way, and a result here has no legal
          effect.
        </p>
      </Section>

      <Section title="It may be wrong">
        <p>
          This is worth stating plainly rather than burying. The rules encoded
          here are built from the <em>Citizenship Act</em> as amended{" "}
          {ACT_AS_OF}, from published IRCC guidance, and from an access-to-information
          release in which{" "}
          <strong className="font-medium">
            material passages are withheld
          </strong>
          . On some points the government&rsquo;s own documents contradict each
          other, and IRCC has paused processing on certain categories of claim
          while it works out how to handle them.
        </p>
        <p>
          Where an answer depends on a point that cannot currently be resolved,
          c3check marks it as uncertain instead of guessing. But it can still be
          wrong, including in ways that are not flagged. Treat every result as a
          starting point for your own research, never as a conclusion.
        </p>
      </Section>

      <Section title="Get professional advice">
        <p>
          In Canada, only licensed lawyers, notaries in Quebec, and members of
          the College of Immigration and Citizenship Consultants may give
          immigration advice for a fee. c3check is free and takes no position on
          your individual circumstances precisely because it is not qualified to.
        </p>
        <p>
          Before you file anything, spend money, or make a decision that matters
          — moving, renouncing another citizenship, planning where a child is
          born — talk to someone licensed.
        </p>
      </Section>

      <Section title="No warranty, and limits on liability">
        <p>
          This site is provided &ldquo;as is&rdquo;, without warranty of any
          kind, express or implied, including as to accuracy, completeness, or
          fitness for any purpose. It may be unavailable, out of date, or
          incorrect at any time.
        </p>
        <p>
          To the fullest extent permitted by law, the author is not liable for
          any loss or damage arising from your use of this site or reliance on
          anything it produces — including missed deadlines, refused
          applications, or costs incurred. If you are not willing to accept
          that, please do not use it.
        </p>
      </Section>

      <Section title="Your responsibilities">
        <p>
          Only enter information about other people — including relatives — that
          you have a legitimate reason to hold. Everything you enter stays in
          your own browser, as described in the{" "}
          <Link href="/privacy" className="text-brand underline underline-offset-4">
            privacy policy
          </Link>
          , so you remain responsible for it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms may change as the tool develops or as the law does. The
          date at the top reflects the last substantive revision. If the change
          is significant you will be asked to accept the terms again.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, corrections, and bug reports go to{" "}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-4"
          >
            GitHub issues
          </a>
          . If you believe a rule is encoded incorrectly, please say which
          paragraph and cite a source — corrections of that kind are genuinely
          welcome.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-3 space-y-4 leading-7 text-muted">{children}</div>
    </section>
  );
}
