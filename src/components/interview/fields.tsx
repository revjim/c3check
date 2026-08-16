"use client";

/**
 * The form primitives the interview screens are built from.
 *
 * Radios rather than click-to-advance buttons throughout. Three reasons, and
 * the third is the one that matters most: arrow-key navigation comes free with
 * a radio group and has to be hand-built for a row of buttons; a radio group
 * has a `<legend>` that screen readers announce with every option; and a
 * previously given answer is visibly selected when the user comes back to the
 * screen, which a button cannot show at all.
 */

import type { ReactNode } from "react";

/**
 * The question, which on a one-question screen is also the page heading.
 *
 * `<h1>` inside `<legend>` rather than one or the other: the heading is what
 * gives the screen a title in a headings list, and the legend is what makes a
 * screen reader announce the question again with each radio. Both are wanted,
 * and nesting them is the established way to have both without repeating the
 * text in the markup.
 */
export function Legend({
  children,
  heading = true,
}: {
  children: ReactNode;
  heading?: boolean;
}) {
  return (
    <legend className="w-full">
      {heading ? (
        <h1 className="text-xl font-medium leading-8 text-balance">
          {children}
        </h1>
      ) : (
        <span className="text-xl font-medium leading-8 text-balance">
          {children}
        </span>
      )}
    </legend>
  );
}

export function Fieldset({
  legend,
  describedBy,
  children,
  className,
}: {
  legend: ReactNode;
  describedBy?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      aria-describedby={describedBy}
      className={className ?? "mt-8"}
    >
      <Legend heading={false}>{legend}</Legend>
      {children}
    </fieldset>
  );
}

export function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition-colors has-checked:border-brand has-checked:bg-brand/5 hover:bg-surface">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="leading-6">
        <span className="font-medium">{label}</span>
        {hint === undefined ? null : (
          <span className="mt-1 block text-sm leading-6 text-muted">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function RadioGroup({ children }: { children: ReactNode }) {
  return <div className="mt-5 space-y-2">{children}</div>;
}

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange"
>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="mt-1 text-sm leading-6 text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        {...rest}
      />
    </div>
  );
}

/** A validation message. `role="alert"` so it is announced when it appears. */
export function FieldError({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === false) {
    return null;
  }
  return (
    <p role="alert" className="mt-2 text-sm font-medium leading-6 text-brand">
      {children}
    </p>
  );
}

/** The collapsed list of documents that would settle a question. */
export function Documents({ documents }: { documents: string[] }) {
  if (documents.length === 0) return null;
  return (
    <details className="mt-6 rounded-lg border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium">
        What would settle this
      </summary>
      <ul className="mt-3 ml-5 list-disc space-y-2 text-sm leading-6 text-muted">
        {documents.map((document) => (
          <li key={document}>{document}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The *why*, shown rather than collapsed.
 *
 * Deliberately not a `<details>`. The reason a question is being asked is what
 * makes this tool worth trusting, and it should not be one keystroke away from
 * invisible.
 */
export function Why({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-4 leading-7 text-muted">
      {children}
    </p>
  );
}
