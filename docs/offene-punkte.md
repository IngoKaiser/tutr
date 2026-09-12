# Offene Punkte

Sachen, die **du** von Hand erledigen musst und die gerade nicht sofort gehen –
abgelegt, damit sie nicht im Chatverlauf verschwinden.

**Nicht zu verwechseln mit `docs/PLAN.md`:** Dort stehen Tickets, also Arbeit an
der App. Hier steht Handarbeit an Umgebung, Konten und Werkzeugen – Dinge, die
Claude nicht selbst tun kann oder nicht selbst tun soll.

Erledigtes wird gestrichen (`~~…~~`) und beim nächsten Aufräumen entfernt, nicht
still gelöscht: Woran man einmal hing, ist beim nächsten Mal die nützlichste
Notiz.

| Punkt                                                                                                                                                                                                                                                                                                                                                | Warum offen                                                                                                                                                                                                            | Seit       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Worktree `practical-pike-e96dba` entfernen** und dabei drei gemergte Branches löschen (`claude/v-03d-v-06a-vokabeln`, `chore/offene-punkte`, `chore/offene-punkte-ergaenzung`):<br>`git worktree remove ".claude/worktrees/practical-pike-e96dba" && git branch -D claude/v-03d-v-06a-vokabeln chore/offene-punkte chore/offene-punkte-ergaenzung` | PR #90 und #91 sind gemerged, `--delete-branch` konnte keinen der Branches entfernen, weil im selben Worktree jeweils der nächste ausgecheckt war. Muss aus dem Hauptverzeichnis laufen, nicht aus dem Worktree selbst | 2026-09-12 |
| **Deploy von `93ee31e` auf `mytutr.de` anschauen** – läuft `/ueben` und der Service Worker in Produktion?                                                                                                                                                                                                                                            | CI und Security sind grün, aber von diesem Rechner aus ist `mytutr.de` nicht erreichbar (Zscaler antwortet mit 403), der Deploy ist also ungeprüft                                                                     | 2026-09-12 |
