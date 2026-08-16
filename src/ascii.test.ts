/**
 * Source stays on a US keyboard.
 *
 * Commit a1612c3 removed every curly quote, en dash and non-breaking space from
 * this repository, and nothing stopped them coming back: a paste from a PDF, a
 * word processor, or an editor with smart quotes on reintroduces them silently,
 * and they survive review because they look right. This walks the tree and
 * fails loudly instead.
 *
 * The second assertion is the JSX half of the same rule. React needs `'` and
 * `"` escaped in text, and the repo settled on `&apos;` and `&quot;` because
 * they are unambiguous; `&rsquo;` and friends would render a curly character
 * from ASCII source and defeat the point of the first assertion.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL(".", import.meta.url));

const EXTENSIONS = [".ts", ".tsx", ".css"];

/** Curly quotes, dashes and spaces have HTML entity forms that undo the rule. */
const FORBIDDEN_ENTITIES = [
  "&ldquo;",
  "&rdquo;",
  "&lsquo;",
  "&rsquo;",
  "&mdash;",
  "&ndash;",
  "&nbsp;",
  "&hellip;",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourceFiles(`${path}/`));
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(path);
    }
  }
  return out.sort();
}

const FILES = sourceFiles(SRC);

describe("source text", () => {
  it("finds files to check", () => {
    // Guards the walk itself: a broken path would make every test below pass.
    expect(FILES.length).toBeGreaterThan(20);
  });

  it("uses only characters on a US keyboard", () => {
    for (const file of FILES) {
      const text = readFileSync(file, "utf8");
      const offenders = new Set<string>();
      for (const char of text) {
        // Tab, newline and carriage return are the only control characters a
        // source file has any business containing.
        const code = char.codePointAt(0) ?? 0;
        if (code === 9 || code === 10 || code === 13) continue;
        if (code < 32 || code > 126) offenders.add(char);
      }
      expect([...offenders], file.slice(SRC.length)).toEqual([]);
    }
  });

  it("does not smuggle curly punctuation back in as HTML entities", () => {
    for (const file of FILES) {
      // This file names the entities in order to forbid them.
      if (file.endsWith("ascii.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      const found = FORBIDDEN_ENTITIES.filter((entity) => text.includes(entity));
      expect(found, file.slice(SRC.length)).toEqual([]);
    }
  });
});
