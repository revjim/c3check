import Link from "next/link";
import { AUTHOR_REDDIT_URL, REPO_URL, SITE_UPDATED } from "@/lib/site";

const LINKS = [
  { href: "/sources", label: "Sources" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <p className="text-sm leading-6 text-muted">
          c3check is a free educational tool. It is{" "}
          <strong className="font-medium text-foreground">
            not legal or immigration advice
          </strong>{" "}
          and is not affiliated with IRCC or the Government of Canada. Verify
          any result against the primary sources and consult a licensed lawyer
          or a CICC member before acting on it. Created by{" "}
          <a
            href={AUTHOR_REDDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            /u/revjim
          </a>{" "}
          as a service to the lost Canadian community.
        </p>

        <p className="mt-2 text-sm text-subtle">Last updated {SITE_UPDATED}</p>

        <nav className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              {label}
            </Link>
          ))}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
