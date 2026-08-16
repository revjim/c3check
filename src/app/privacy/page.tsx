import type { Metadata } from "next";
import { ClearDataButton } from "@/components/ClearDataButton";
import { CONSENT_KEY, DRAFT_KEY, ISSUES_URL, POLICY_UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Your family details are processed entirely in your browser and are never sent to a server.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-subtle">Last updated {POLICY_UPDATED}</p>

      <div className="mt-8 rounded-lg border border-brand/30 bg-brand/5 p-5">
        <p className="leading-7">
          <strong className="font-semibold">
            The names, dates, and places you enter never leave your browser.
          </strong>{" "}
          There is no account, no database, and no server that receives your
          family details. Everything is calculated on your own device.
        </p>
      </div>

      <Section title="Why it works this way">
        <p>
          A tool like this necessarily handles information about living people
          who have not agreed to anything: your parents, grandparents, your
          children. The cleanest way to protect that is not to collect it. So
          the classifier runs entirely as code in your browser, and there is no
          server endpoint that family data is sent to.
        </p>
      </Section>

      <Section title="What is stored on your device">
        <p>
          So that a long interview survives a refresh, c3check saves your
          progress in your browser&apos;s <code className="font-mono text-sm">localStorage</code>{" "}
          under two keys:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <code className="font-mono text-sm">{DRAFT_KEY}</code>, the family
            line you have entered and the answers you have given.
          </li>
          <li>
            <code className="font-mono text-sm">{CONSENT_KEY}</code>, a record
            that you accepted the terms, so you are not asked repeatedly.
          </li>
        </ul>
        <p>
          This stays on your device and is not transmitted. It does mean that
          anyone else who uses the same browser profile could see it, so take
          care on a shared or public computer. You can erase both at any time:
        </p>
        <ClearDataButton />
      </Section>

      <Section title="Nothing goes in the URL">
        <p>
          c3check deliberately does not offer shareable result links. Putting a
          family line into a URL would place it in your browser history, in the
          history of anyone you sent it to, and in the logs of any service the
          link passed through. The convenience is not worth that, so results
          live only in the page you are looking at.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          This site uses{" "}
          <a
            href="https://vercel.com/docs/analytics/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-4"
          >
            Vercel Web Analytics
          </a>{" "}
          to count page views, so it is possible to tell whether the tool is
          being used and which pages people struggle with. It is cookieless, it
          does not track you across sites, and it does not build a profile of
          you. Vercel Inc. acts as the processor for that data.
        </p>
        <p>
          Analytics records which <em>pages</em> are visited. It does not and
          cannot see the contents of your interview, because that data never
          leaves your browser and never appears in a URL.
        </p>
      </Section>

      <Section title="Hosting">
        <p>
          The site is hosted by Vercel. Like any web host, its infrastructure
          logs the requests it serves, including IP addresses and browser user
          agents, for delivery, security, and abuse prevention. That is
          ordinary web-server logging and applies to the page itself, not to
          anything you type into it.
        </p>
      </Section>

      <Section title="Links to other sites">
        <p>
          c3check links out to the <em>Citizenship Act</em>, to court decisions,
          and to IRCC guidance. Those sites have their own privacy practices and
          this policy does not cover them.
        </p>
      </Section>

      <Section title="Children">
        <p>
          A citizenship line often includes children, and you may enter a
          child&apos;s birth details as part of your own family line. That
          information is treated exactly like everything else here: it stays on
          your device. The site is not directed at children as users.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes materially, the date at the top will change
          with it. Questions or concerns about privacy go to{" "}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-4"
          >
            GitHub issues
          </a>
          . Note that issues are public, so please do not include personal or
          family details in one.
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
