"use client";

/**
 * Day, month and year as three numeric boxes, plus "I only know the year".
 *
 * All the parsing is in `src/lib/dateEntry.ts`; this is the markup and the
 * boundary warning. See that file for why this is not `<input type="date">`.
 */

import { useId } from "react";
import { FieldError } from "./fields";
import { readDateParts, describeEntry } from "@/lib/dateEntry";
import type { DateParts } from "@/lib/dateEntry";
import { nearBoundary } from "@/lib/precision";

export function DateFields({
  legend,
  parts,
  yearOnly,
  onParts,
  onYearOnly,
  showError,
  required,
  yearOnlyLabel = "I only know the year",
}: {
  legend: string;
  parts: DateParts;
  yearOnly: boolean;
  onParts: (parts: DateParts) => void;
  onYearOnly: (yearOnly: boolean) => void;
  /** Suppressed until the user tries to submit, so typing is not nagged at. */
  showError: boolean;
  required: boolean;
  yearOnlyLabel?: string;
}) {
  const id = useId();
  const entry = readDateParts(parts, yearOnly);
  const echo = describeEntry(entry, yearOnly);
  const boundaries = entry.state === "valid" ? nearBoundary(entry.iso) : [];

  const message =
    entry.state === "invalid"
      ? entry.message
      : showError && required && entry.state !== "valid"
        ? yearOnly
          ? "Enter the year."
          : "Enter a day, a month and a year."
        : null;

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium">{legend}</legend>

      <div className="mt-2 flex flex-wrap items-end gap-3">
        {yearOnly ? null : (
          <>
            <Box
              id={`${id}-day`}
              label="Day"
              width="w-16"
              max={2}
              value={parts.day}
              onChange={(day) => onParts({ ...parts, day })}
            />
            <Box
              id={`${id}-month`}
              label="Month"
              width="w-20"
              max={2}
              value={parts.month}
              onChange={(month) => onParts({ ...parts, month })}
            />
          </>
        )}
        <Box
          id={`${id}-year`}
          label="Year"
          width="w-24"
          max={4}
          value={parts.year}
          onChange={(year) => onParts({ ...parts, year })}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={yearOnly}
          onChange={(event) => onYearOnly(event.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        {yearOnlyLabel}
      </label>

      <FieldError>{message}</FieldError>

      {echo === null || message !== null ? null : (
        <p className="mt-2 text-sm text-subtle">{echo}</p>
      )}

      {boundaries.map((boundary) => (
        <div
          key={boundary.date}
          className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm leading-6"
        >
          <p className="font-medium">
            {yearOnly
              ? `You said about ${parts.year}. Whether this was before or after ${boundary.label} decides which paragraph applies.`
              : `This date is close to ${boundary.label}, which the Act turns on.`}
          </p>
          <p className="mt-1 text-muted">{boundary.matters}</p>
          {yearOnly ? (
            <p className="mt-1 text-muted">
              If you can find the month and day, this is the one date worth
              going back to the records for.
            </p>
          ) : null}
        </div>
      ))}
    </fieldset>
  );
}

function Box({
  id,
  label,
  value,
  onChange,
  width,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  width: string;
  max: number;
}) {
  return (
    <span className="block">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={max}
        value={value}
        onChange={(event) =>
          // Strip anything that is not a digit here rather than reporting it as
          // an error: a stray character from a paste is not worth a sentence.
          onChange(event.target.value.replace(/[^0-9]/g, "").slice(0, max))
        }
        className={`mt-1 h-11 ${width} rounded-lg border border-border bg-background px-3 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand`}
      />
    </span>
  );
}
