#!/usr/bin/env bash
# Einmalig nach dem Klonen ausführen.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Abhängigkeiten (aus package-lock.json)"
npm ci

echo "▶ Git-Hooks"
npm run prepare

echo "▶ Playwright-Browser (nur Chromium)"
npx playwright install chromium

echo "▶ Qualitätscheck"
npm run check

echo "✔ Fertig. Nächster Schritt: cp .env.example .env.local, Schlüssel eintragen, dann Ticket F-02 in docs/PLAN.md."
