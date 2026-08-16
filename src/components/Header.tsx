import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo className="h-6 w-6 text-brand" />
          <span className="text-lg font-semibold tracking-tight">c3check</span>
        </Link>
        <nav>
          <Link
            href="/sources"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Sources
          </Link>
        </nav>
      </div>
    </header>
  );
}
