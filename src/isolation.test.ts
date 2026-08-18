/**
 * Third-party code stays outside the origin.
 *
 * /privacy promises in bold that the names, dates and places a user enters never
 * leave their browser, and enumerates the only two `localStorage` keys that
 * exist. One third-party script on the results page would make all of that
 * untrue at once: it can read the DOM, which holds the whole family line, and it
 * can read and write storage.
 *
 * There is now no third-party code at all: the donation widget that used to run
 * in a sandboxed frame is gone, and nothing replaced it. So /privacy says
 * plainly that every line of code served here is served from here, and these
 * tests are what keeps that sentence true, in the style of `src/ascii.test.ts`.
 *
 * The frame rules below have nothing to catch today, and that is the point of
 * keeping them. The next embed somebody reaches for is the dangerous one, and it
 * will arrive in a change about something else entirely.
 *
 * This is the same kind of enforcement the GEDCOM parser already has: /privacy
 * says a promise about the code is kept by a test rather than by memory, and
 * these are the tests it means.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

function filesUnder(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...filesUnder(`${path}/`, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(path);
    }
  }
  return out.sort();
}

const SOURCE = filesUnder(SRC, [".ts", ".tsx"]);
const MARKUP = [
  ...filesUnder(SRC, [".tsx"]),
  ...filesUnder(PUBLIC, [".html"]),
];

/** Every `<iframe` opening tag in a file, up to its closing angle bracket. */
function iframeTags(text: string): string[] {
  return [...text.matchAll(/<iframe\b[^>]*>/gi)].map((match) => match[0]);
}

/** Every literal `sandbox="..."` value, wherever it appears. */
function sandboxValues(text: string): string[] {
  return [...text.matchAll(/\bsandbox\s*=\s*"([^"]*)"/g)].map(
    (match) => match[1],
  );
}

/** Every literal `src="..."` value, wherever it appears. */
function srcValues(text: string): string[] {
  return [...text.matchAll(/\bsrc\s*=\s*"([^"]*)"/g)].map((match) => match[1]);
}

describe("frames", () => {
  it("finds markup to check", () => {
    // Guards the walk itself: a broken path would make every test below pass.
    expect(MARKUP.length).toBeGreaterThan(10);
  });

  it("sandboxes every iframe", () => {
    for (const file of MARKUP) {
      const text = readFileSync(file, "utf8");
      for (const tag of iframeTags(text)) {
        expect(/\bsandbox\b/.test(tag), `${label(file)}: ${tag}`).toBe(true);
      }
    }
  });

  it("writes every sandbox as a literal string, never an expression", () => {
    // A `sandbox={value}` would put the permission list somewhere this test
    // cannot read it, and the assertion below would pass by not looking.
    for (const file of MARKUP) {
      const text = readFileSync(file, "utf8");
      for (const tag of iframeTags(text)) {
        expect(sandboxValues(tag).length, `${label(file)}: ${tag}`).toBe(1);
      }
    }
  });

  it("never grants a sandboxed frame the parent's origin", () => {
    // The one token an embed like this rests on. With it, the frame shares this
    // origin and can read `localStorage` and the family line in the DOM.
    for (const file of [...SOURCE, ...MARKUP]) {
      const text = readFileSync(file, "utf8");
      for (const value of sandboxValues(text)) {
        expect(value.split(/\s+/), label(file)).not.toContain(
          "allow-same-origin",
        );
      }
    }
  });
});

describe("scripts", () => {
  it("loads no script from anywhere under src", () => {
    // A `<script src>` in a component would run on this origin. Same-origin
    // code is an import; there is nowhere else code is allowed to come from.
    for (const file of SOURCE) {
      if (file.endsWith("isolation.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      expect(/<\s*script\b[^>]*\bsrc\b/i.test(text), label(file)).toBe(false);
      expect(text.includes('from "next/script"'), label(file)).toBe(false);
    }
  });

  it("loads nothing at all from another host", () => {
    // Broader than a list of known widget hosts, which only catches the ones
    // somebody thought of: no `src` anywhere may leave this origin, whether it
    // is a script, a frame, an image or a font.
    for (const file of [...SOURCE, ...MARKUP]) {
      if (file.endsWith("isolation.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      const remote = srcValues(text).filter((value) =>
        /^(https?:)?\/\//i.test(value),
      );
      expect(remote, label(file)).toEqual([]);
    }
  });
});

function label(path: string): string {
  return path.startsWith(SRC) ? `src/${path.slice(SRC.length)}` : path;
}
