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
            line you have entered and the answers you have given. Concretely:
            any name or description you typed for a relative, exactly as you
            typed it, each birth date, each place of birth, any date of death,
            and every answer to a question the interview asked.
          </li>
          <li>
            <code className="font-mono text-sm">{CONSENT_KEY}</code>, a record
            that you accepted the terms, so you are not asked repeatedly.
          </li>
        </ul>
        <p>
          That is the complete list. There is no third key, no cookie carrying
          any of it, and nothing is copied anywhere else on the way through.
        </p>
        <p>
          This stays on your device and is not transmitted. It does mean that
          anyone else who uses the same browser profile could see it, so take
          care on a shared or public computer. You can erase both at any time:
        </p>
        <ClearDataButton />
      </Section>

      <Section title="Nothing goes in the URL">
        <p>
          <strong className="font-medium text-foreground">
            The only thing that ever appears in the URL is a step number.
          </strong>{" "}
          Not a name, not a date, not a place, and not an answer. The interview
          addresses each question as a plain ordinal, so a page in your browser
          history reads{" "}
          <code className="font-mono text-sm">/check/interview?step=4</code>{" "}
          and nothing more. Which question that was depends entirely on what is
          stored on your device, and cannot be worked out from the address.
        </p>
        <p>
          c3check also deliberately does not offer shareable result links.
          Putting a family line into a URL would place it in your browser
          history, in the history of anyone you sent it to, and in the logs of
          any service the link passed through. The convenience is not worth
          that, so results live only in the page you are looking at.
        </p>
        <p>
          To keep a copy, print the results page, use the button that copies it
          as plain text, or download it as a markdown file. All three are made in
          your browser and none of them is uploaded anywhere.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            The download holds every name, date and place you entered.
          </strong>{" "}
          That is the point of it: it also contains your interview as data, so
          uploading it again restores every answer. It is an ordinary file on
          your device, which means it is no longer covered by anything this
          policy can promise. It goes wherever you send it, it can be read by
          anyone who gets a copy, and an email attachment sits on a mail server.
          If a family line is sensitive, treat the file the way you would treat a
          photograph of the certificates it is about.
        </p>
      </Section>

      <Section title="Files you import">
        <p>
          If you import a file, whether a GEDCOM family tree or a c3check
          download of your own, it is read by code running in your
          browser. There is no upload and no server endpoint that receives it.
          The parsed file is held in the page while you use it and is discarded
          when you reload, navigate away, or press &quot;Forget this
          file&quot;. From a family tree, only the people in the line you
          actually choose are copied into the saved draft described above. A
          c3check file is your own interview coming back, so all of it is
          restored into a new line; nothing already saved on the device is
          overwritten or deleted.
        </p>
        <p>
          Most of a family tree is never read at all. It carries notes,
          sources, photographs, addresses, causes of death and medical facts
          about living people who have not agreed to anything, so the parser
          reads only names, sexes, dates, places and parent links, and discards
          everything else before it reaches memory. That is enforced in the code
          rather than promised: there is a test that parses a file full of notes
          and addresses and asserts that none of that text survives.
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
          this policy does not cover them. They are links and nothing more: no
          code from any of them runs on this site, so none of them can see
          anything you have entered here.
        </p>
      </Section>

      <Section title="The donation button">
        <p>
          The yellow &quot;Buy me a coffee&quot; button on the home page and at
          the foot of a result is the widget Buy Me a Coffee supplies, which
          means it is a piece of their code, loaded from their servers, running
          in your browser. Buy Me a Coffee can therefore see that a browser at
          your IP address loaded the button, and the fonts it uses are requested
          from Google, so Google can see the same thing.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            It cannot see anything about your family line.
          </strong>{" "}
          The button is not on the page itself. It is loaded inside a sandboxed
          frame, from a small separate document that contains nothing but the
          button, and that frame is deliberately given no access to this site&apos;s
          own origin. Concretely: code inside it cannot read the{" "}
          <code className="font-mono text-sm">localStorage</code> keys listed
          above, cannot read the page around it, and cannot store anything of its
          own that this policy would then have to account for. Clicking it opens
          buymeacoffee.com in a new tab, which is where anything you choose to
          pay is handled; nothing about payment happens here.
        </p>
        <p>
          That isolation is one attribute on one element, so it is enforced by a
          test rather than by memory. The test suite fails the build if any frame
          on this site loses its sandbox, if any frame is granted this
          origin, or if a third-party script appears anywhere in the site&apos;s
          own code.
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
