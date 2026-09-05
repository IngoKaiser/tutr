---
description: Code-Review der aktuellen Änderungen (git diff) gegen CLAUDE.md und Definition of Done
---

Prüfe `git diff` (staged und unstaged) gegen CLAUDE.md und die Definition of Done.

Berichte in dieser Reihenfolge, nur was zutrifft:

1. Verstöße gegen Domänenregeln (Eltern/Chat-Trennung, Hausaufgaben-Regeln, Schichten, pseudonyme Profile)
2. Fehlende RLS oder Sicherheitsprobleme (Input-Validierung, Auth-Checks in Server Actions, Secrets)
3. Fehlende oder schwache Tests
4. Typen, `any`, Lint-Umgehungen
5. UX: deutsche Texte, Fehlermeldungen, Ton

Keine Stilkritik ohne Konsequenz. Ende mit: „Merge-fähig: ja/nein" und den maximal drei wichtigsten Änderungen.
