"use client";

import { useState } from "react";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { UndoLoeschen } from "@/components/shell/swipe-row";
import { useDeferredDelete } from "@/components/shell/use-deferred-delete";
import { filtereGespraeche } from "@/lib/tutor/gespraechs-suche";

import { deleteTutorSession, type SessionSummary } from "../actions";
import { NachFach } from "../gespraechs-liste";

/**
 * Das Archiv der Gespräche (T-19c, ADR 0014 D3): alles, nach Fach gruppiert,
 * mit Suche über Titel und Fach.
 *
 * `/tutor` bleibt damit Startfläche und zeigt nur die letzten sechs. Die
 * Gruppierung nach Fach (§15, ADR 0013 D6) wandert hierher, wo sie hingehört:
 * Sie hilft beim **Wiederfinden**, nicht beim Weitermachen.
 *
 * Das Löschen ist dasselbe wie auf `/tutor` (T-15) – Wisch, fünf Sekunden
 * Rückgängig-Fenster, dann erst der Serveraufruf.
 */
export function ArchivView({ sessions }: { sessions: SessionSummary[] }) {
  const [suche, setSuche] = useState("");
  const geloescht = useDeferredDelete<SessionSummary>((id) => deleteTutorSession(id));

  const uebrig = sessions.filter((s) => !geloescht.istEntfernt(s.id));
  const gefunden = filtereGespraeche(uebrig, suche);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Alle Gespräche"
        trailing={uebrig.length > 0 ? `${uebrig.length}` : undefined}
        // `label` benennt die Zielseite so, wie sie oben heißt (T-18).
        back={{ href: "/tutor", label: "Tutor" }}
      />

      {sessions.length === 0 ? (
        <Block>
          <Notice>Noch keine Gespräche. Die erste Frage auf der Tutor-Seite startet eins.</Notice>
        </Block>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Gespräche durchsuchen</span>
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suchen – Titel oder Fach"
              className="border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:-outline-offset-1"
            />
          </label>

          {gefunden.length === 0 ? (
            <Block>
              <Notice>Nichts gefunden. Vielleicht heißt das Gespräch anders, als du denkst.</Notice>
            </Block>
          ) : (
            <Block>
              <NachFach sessions={gefunden} onLoeschen={(s) => geloescht.entfernen(s)} />
            </Block>
          )}
        </>
      )}

      {/* Außerhalb des Blocks: `sticky` braucht als Bezug den scrollenden
          Bereich, nicht die Karte drumherum (V-12). */}
      <UndoLoeschen
        eintraege={geloescht.pending.map((e) => ({
          id: e.id,
          label: e.title.trim() || "Gespräch",
        }))}
        onZurueck={(id) => geloescht.zuruecknehmen(id)}
      />
    </div>
  );
}
