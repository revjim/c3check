/**
 * The three button shapes this site uses, as a class string.
 *
 * Deliberately a function rather than a `<Button>` component. `/` and `/check`
 * are Server Components, and a component would drag them across a client
 * boundary for the sake of a string of Tailwind classes.
 *
 * No red anywhere, including for destructive actions: red is barred by the
 * brand rule (see `src/components/Logo.tsx`), and nothing here deletes anything
 * the user cannot re-enter.
 */

export type ButtonVariant = "primary" | "secondary" | "quiet";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `h-11 rounded-full bg-brand px-6 font-medium text-white transition-opacity hover:opacity-90 ${FOCUS}`,
  secondary: `h-10 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-surface ${FOCUS}`,
  quiet: `h-9 rounded-full px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground ${FOCUS}`,
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  extra?: string,
): string {
  const base = `inline-flex items-center justify-center ${VARIANTS[variant]}`;
  return extra === undefined ? base : `${base} ${extra}`;
}
