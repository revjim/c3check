import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json. Done by hand rather than
    // via vite-tsconfig-paths to avoid the extra dependency for one mapping.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Everything under test is pure, so no DOM is needed and none is loaded.
    //
    // `include` is the enforcement, not a convenience: a `.test.tsx` is not
    // collected at all, so adding a `// @vitest-environment jsdom` docblock to
    // one would not run it. That is deliberate. Every decision the UI makes
    // lives in a pure module (`draft.ts`, `interview.ts`, `report.ts`,
    // `precision.ts`, `src/lib/gedcom/*`), leaving each component a switch over
    // some JSX; wanting to test a component is usually evidence that logic
    // leaked out of one of those modules and should be moved back. The gaps
    // jsdom would cover are covered elsewhere: `tsc --noEmit` typechecks every
    // `.tsx`, `next build` is the only thing that catches a missing Suspense
    // boundary around `useSearchParams`, and eslint-plugin-jsx-a11y catches the
    // label and control mistakes.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
