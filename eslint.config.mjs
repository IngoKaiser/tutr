import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright-Artefakte. Sie stehen in .gitignore, aber ESLint 9 liest die
    // nicht – ohne diese Zeilen scheitert `npm run check`, sobald jemand die
    // E2E-Tests mit dem HTML-Reporter laufen lässt (also in CI-Nachstellungen).
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
