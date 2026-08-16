/**
 * A small strip of context under /check.
 *
 * The site header stays as it is; this is the one place a user needs to know
 * which of the /check pages they are on and how to get back to the others. It
 * is a Server Component, and hidden from print, where none of it is useful.
 */

import Link from "next/link";

export function Breadcrumb({
  trail,
}: {
  trail: { href?: string; label: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto w-full max-w-2xl px-6 pt-6 print:hidden"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {trail.map((crumb, i) => (
          <li key={crumb.label} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {crumb.href === undefined ? (
              <span aria-current="page" className="text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
