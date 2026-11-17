import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    setupFiles: ["./apps/web/tests/setup-identity.ts"],
    include: ["packages/*/tests/**/*.test.ts", "apps/*/tests/**/*.test.ts"],
  },
});
