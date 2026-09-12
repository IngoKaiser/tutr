"use client";

import Link from "next/link";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { UndoLoeschen } from "@/components/shell/swipe-row";
import { useDeferredDelete } from "@/components/shell/use-deferred-delete";
import type { Auslastung } from "@/lib/ai/rate-limit";

import { deleteTutorSession, type SessionSummary, type TutorOverview } from "./actions";
import { Conversation } from "./chat";
import { NachZeit } from "./gespraechs-liste";

/**
 * `/tutor` (T-07, umgebaut in T-13 und T-19c): die zuletzt geführten
 * Gespräche plus der Beginn eines neuen, in einer Komponente.
 *
 * **Kein eigenes Formular** (ADR 0013 D1): Diese Seite rendert einfach
 * `Conversation` mit `sessionId={null}`, `subjectId={null}` – genau dieselbe
 * Komponente wie ein bestehendes Gespräch auf `/tutor/<id>`. Solange nichts
 * geschickt wurde, füllt `leerInhalt` (die Liste hier unten) den Platz, an
 * dem sonst Nachrichten stünden; sobald die erste Frage raus ist, blendet
 * `Conversation` sie automatisch aus (`leer` wird `false`) und zeigt
 * stattdessen die Antwort. Kopfzeile (Rückweg + Fach-Chip) erscheint erst,
 * sobald ein Gespräch existiert – auf dieser Seite gibt es vorher nichts,
 * wohin man „zurück" gehen könnte.
 *
 * Angelegt wird die Session **nicht** hier: Die Zeile in der Datenbank
 * entsteht erst mit der ersten Frage, drüben im Sendeweg. So sammeln sich
 * keine leeren Gespräche an, nur weil jemand einmal geschaut hat.
 *
 * **„Zuletzt" statt der ganzen Historie** (T-19c, ADR 0014 D3): Hier stehen
 * sechs Gespräche, nach Zeit sortiert; die volle, nach Fach gruppierte Liste
 * steht unter `/tutor/gespraeche`. Die Gruppierung nach Fach ist eine
 * Archiv-Eigenschaft – sie hilft beim Wiederfinden. Auf der Startfläche
 * zählt „woran war ich dran", und das ist eine Frage der Zeit.
 *
 * **Wischen zum Löschen** (T-15): dieselben Bausteine wie bei den
 * Vokabelsets (V-11) – `SwipeRow` für die Geste, `useDeferredDelete` fürs
 * Rückgängig-Fenster. Der Hook lebt hier statt in der Liste, weil sowohl die
 * Liste (`istEntfernt` zum Ausblenden) als auch die Rückgängig-Leiste
 * (`pending`) davon wissen müssen, und beide über `leerInhalt` in
 * `Conversation` hineingereicht werden. Gilt für Hausaufgaben-Sessions
 * genauso wie für freie Gespräche – `deleteTutorSession()` kennt den
 * Unterschied nicht, beide hängen an derselben `tutor_session`-Zeile.
 */
export function TutorOverviewView({
  overview,
  available,
  auslastung,
}: {
  overview: TutorOverview | null;
  available: boolean;
  auslastung: Auslastung | null;
}) {
  // Immer aufgerufen, auch ohne `overview` (Hooks-Regel) – der Rückgabewert
  // bleibt dann einfach ungenutzt.
  const geloescht = useDeferredDelete<SessionSummary>((id) => deleteTutorSession(id));

  if (!overview) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Tutor" />
        <Block>
          <Notice>Der Tutor ist gerade nicht verfügbar.</Notice>
        </Block>
      </div>
    );
  }

  const sichtbar = overview.sessions.filter((s) => !geloescht.istEntfernt(s.id));

  return (
    <Conversation
      sessionId={null}
      subjectId={null}
      subjectName={null}
      subjectLanguage={null}
      topicTitle={null}
      entryPoint="freie_frage"
      initialMessages={[]}
      available={available}
      auslastung={auslastung}
      alleFaecher={overview.subjects}
      leerInhalt={
        <>
          <Zuletzt
            sessions={sichtbar}
            gesamt={overview.gesamt}
            onLoeschen={(s) => geloescht.entfernen(s)}
          />
          {/* Sitzt in derselben scrollenden Fläche wie die Liste
              (`verlaufRef` in `chat.tsx`), nicht außerhalb: `sticky` braucht
              als Bezug genau diesen Scrollbereich (V-12), und der ist seit
              T-12a nicht mehr `main`. */}
          <UndoLoeschen
            eintraege={geloescht.pending.map((e) => ({
              id: e.id,
              label: e.title.trim() || "Gespräch",
            }))}
            onZurueck={(id) => geloescht.zuruecknehmen(id)}
          />
        </>
      }
    />
  );
}

function Zuletzt({
  sessions,
  gesamt,
  onLoeschen,
}: {
  sessions: SessionSummary[];
  /** Wie viele es insgesamt gibt – entscheidet, ob der Weg ins Archiv überhaupt etwas verspricht. */
  gesamt: number;
  onLoeschen: (session: SessionSummary) => void;
}) {
  if (sessions.length === 0) {
    return (
      <Notice>Noch keine Gespräche. Schreib einfach los – die erste Frage startet eins.</Notice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wider uppercase">
        Zuletzt
      </span>
      <NachZeit sessions={sessions} onLoeschen={onLoeschen} />
      {/* Nur, wenn im Archiv mehr steht als hier: Ein Link auf „alle" neben
          einer Liste, die schon alle ist, wäre ein Versprechen auf nichts.
          Gegen `sessions.length` verglichen, nicht gegen die Sechs – gerade
          gelöschte Zeilen sind hier schon weg, in `gesamt` noch drin. */}
      {gesamt > sessions.length ? (
        <Link
          href="/tutor/gespraeche"
          className="text-tinte-leise hover:text-koenigsblau self-start text-[0.8125rem] font-medium"
        >
          Alle Gespräche ({gesamt}) ›
        </Link>
      ) : null}
    </div>
  );
}
