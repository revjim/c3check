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
    // The classifier is pure; no DOM needed. UI tests, if added later, should
    // opt into jsdom per-file with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
