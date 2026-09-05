#!/usr/bin/env bash
# Einmalig nach dem Klonen ausführen. Installiert Tooling und Laufzeit-Abhängigkeiten in aktuellen Versionen.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Dev-Tooling"
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @vitest/coverage-v8 @playwright/test husky lint-staged prettier prettier-plugin-tailwindcss drizzle-kit

echo "▶ Laufzeit"
npm install zod @supabase/supabase-js @supabase/ssr drizzle-orm postgres ts-fsrs @anthropic-ai/sdk @serwist/next serwist katex \
  @simplewebauthn/server @simplewebauthn/browser

echo "▶ Hooks"
npm run prepare

echo "▶ Playwright-Browser (nur Chromium)"
npx playwright install chromium

echo "▶ Check"
npm run check
echo "✔ Fertig. Nächster Schritt: .env.example nach .env.local kopieren, dann F-02 in docs/PLAN.md."
