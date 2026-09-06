import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Nur Code – sonst versucht der Provider .sql- und .md-Dateien zu parsen.
      include: ["src/lib/**/*.ts", "src/ai/**/*.ts", "src/db/**/*.ts"],
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
