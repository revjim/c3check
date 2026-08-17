/**
 * Third-party code stays outside the origin.
 *
 * /privacy promises in bold that the names, dates and places a user enters never
 * leave their browser, and enumerates the only two `localStorage` keys that
 * exist. One third-party script on the results page would make all of that
 * untrue at once: it can read the DOM, which holds the whole family line, and it
 * can read and write storage.
 *
 * Exactly one third-party script runs on this site, the Buy Me a Coffee button,
 * and it runs inside `public/coffee.html` loaded in a sandboxed frame. The whole
 * guarantee is the absence of one token, `allow-same-origin`, in one attribute,
 * which is far too easy to add back while making an unrelated change. So this
 * walks the tree and fails loudly instead, in the style of `src/ascii.test.ts`.
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

/**
 * Script hosts that must appear nowhere under `src/`, in markup, in prose, or in
 * a comment. Naming one is how the rule stops being checkable: a reviewer who
 * sees the host in a component cannot tell whether it is loaded or discussed.
 */
const THIRD_PARTY_SCRIPT_HOSTS = ["cdnjs.buymeacoffee.com"];

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

describe("frames", () => {
  it("finds markup to check, including the coffee document", () => {
    // Guards the walk itself: a broken path would make every test below pass.
    expect(MARKUP.length).toBeGreaterThan(10);
    expect(MARKUP.some((file) => file.endsWith("coffee.html"))).toBe(true);
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
    // The one token this whole arrangement rests on. With it, the frame shares
    // this origin and can read `localStorage` and the family line in the DOM.
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
    // code is an import; third-party code goes in a sandboxed frame document.
    for (const file of SOURCE) {
      if (file.endsWith("isolation.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      expect(/<\s*script\b[^>]*\bsrc\b/i.test(text), label(file)).toBe(false);
      expect(text.includes('from "next/script"'), label(file)).toBe(false);
    }
  });

  it("keeps every third-party script host out of src entirely", () => {
    for (const file of SOURCE) {
      if (file.endsWith("isolation.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      const found = THIRD_PARTY_SCRIPT_HOSTS.filter((host) =>
        text.includes(host),
      );
      expect(found, label(file)).toEqual([]);
    }
  });

  it("keeps the one third-party script inside the sandboxed document", () => {
    // The other half: the widget really is still there. A refactor that quietly
    // dropped it would otherwise pass everything above.
    const text = readFileSync(`${PUBLIC}coffee.html`, "utf8");
    expect(text).toContain(THIRD_PARTY_SCRIPT_HOSTS[0]);
    expect(text).toContain('data-name="bmc-button"');
  });
});

function label(path: string): string {
  return path.startsWith(SRC) ? `src/${path.slice(SRC.length)}` : path;
}
