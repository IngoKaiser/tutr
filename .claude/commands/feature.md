---
description: Ein Ticket aus docs/PLAN.md planen und umsetzen
---

Setze Ticket $ARGUMENTS aus docs/PLAN.md um.

Vorgehen:

1. Lies das Ticket und die referenzierten Abschnitte in docs/konzept.md. Nenne Unklarheiten, bevor du beginnst.
2. Erstelle einen Plan: betroffene Dateien, Schema-/RLS-Änderungen, Tests, offene Fragen. Warte auf Freigabe.
3. Setze um. Tests zuerst, wo es sinnvoll ist.
4. Führe `npm run check` aus und behebe alles, bis es grün ist.
5. Aktualisiere docs/PLAN.md (Status, Notizen) und schlage eine Commit-Nachricht nach Conventional Commits vor.
