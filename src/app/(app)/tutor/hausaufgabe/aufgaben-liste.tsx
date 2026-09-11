"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Block, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";
import { SwipeRow, UndoLoeschen } from "@/components/shell/swipe-row";
import { useDeferredDelete } from "@/components/shell/use-deferred-delete";

import { ueberspringeAufgabe, type AufgabeSummary, type HausaufgabenListe } from "./actions";

/**
 * **„gehört nicht dazu" statt „übersprungen"** (T-17). §4a nennt den Ausgang
 * „übersprungen", und so heißt der Enum-Wert in der Datenbank weiterhin – die
 * Beschriftung ist trotzdem eine andere, weil sie etwas anderes verspricht.
 *
 * Der einzige gute Grund, eine Aufgabe beiseitezulegen, ist eine, die gar
 * keine ist: ein Merkkasten, den Vision als Aufgabe gelesen hat, eine
 * gestrichene Nummer, eine Überschrift. „Überspringen" lud dagegen zum
 * Ausweichen ein, sobald es schwierig wurde – das Gegenteil dessen, wofür
 * die Hinweisleiter da ist.
 */
const STATUS_LABEL: Record<AufgabeSummary["status"], string> = {
  offen: "offen",
  in_arbeit: "in Arbeit",
  geloest: "gelöst",
  loesung_gezeigt: "Lösung gezeigt",
  uebersprungen: "gehört nicht dazu",
};

const STATUS_TON: Record<AufgabeSummary["status"], string> = {
  offen: "bg-papier-tief text-tinte-leise",
  in_arbeit: "bg-koenigsblau-hell text-koenigsblau",
  geloest: "bg-sicher-hell text-sicher",
  loesung_gezeigt: "bg-offen-hell text-offen",
  uebersprungen: "bg-papier-tief text-tinte-leise",
};

const ABGESCHLOSSEN = new Set<AufgabeSummary["status"]>([
  "geloest",
  "loesung_gezeigt",
  "uebersprungen",
]);

/**
 * Aufgabe · Status (T-03 PR 2, §4a „Ansicht"): eine Zeile je Aufgabe, mit
 * Sprung in den Dialog dieser einen Aufgabe. Der Zweizeiler steht oben,
 * sobald `ladeHausaufgabenListe()` ihn mitliefert (jede Aufgabe
 * abgeschlossen).
 */
export function AufgabenListe({ liste }: { liste: HausaufgabenListe }) {
  const router = useRouter();

  /**
   * Aussortieren mit Rückgängig-Fenster (T-17) – dieselben Bausteine wie
   * beim Löschen (V-11), nur endet der Wisch hier nicht im Löschen, sondern
   * im Status `uebersprungen`. Der Serveraufruf startet erst nach fünf
   * Sekunden; bis dahin holt „Rückgängig" die Aufgabe zurück, ohne dass in
   * der Datenbank je etwas stand.
   *
   * `istEntfernt()` blendet die Zeile deshalb **nicht** aus – anders als in
   * einer Löschliste bleibt sie stehen und zeigt nur schon den neuen Status.
   */
  const aussortiert = useDeferredDelete<AufgabeSummary>(async (taskId) => {
    await ueberspringeAufgabe(liste.sessionId, taskId);
    // Das kann die letzte offene Aufgabe gewesen sein – dann hat der Server
    // gerade den Zweizeiler geschrieben (`pruefeUndErzeugeAbschluss()`).
    // `liste` steckt als Prop fest, ein Neuladen holt ihn.
    router.refresh();
  });

  const aufgaben = liste.aufgaben.map((a) =>
    aussortiert.istEntfernt(a.id) ? { ...a, status: "uebersprungen" as const } : a,
  );
  const offeneAnzahl = aufgaben.filter((a) => !ABGESCHLOSSEN.has(a.status)).length;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Hausaufgabe" back={{ href: "/tutor", label: "Tutor" }} />
      <ContextChip subject={liste.subjectName} />

      {liste.zusammenfassung ? (
        <Block emphasized title="Fertig">
          <p className="text-tinte text-[0.9375rem]">{liste.zusammenfassung}</p>
        </Block>
      ) : offeneAnzahl > 0 ? (
        <Notice>
          {offeneAnzahl} von {aufgaben.length} {aufgaben.length === 1 ? "Aufgabe" : "Aufgaben"} noch
          offen. Eine nach der anderen.
        </Notice>
      ) : null}

      {aufgaben.length === 0 ? (
        <Notice>Noch keine Aufgabe erkannt.</Notice>
      ) : (
        <Block>
          <ul className="flex flex-col gap-2">
            {aufgaben.map((aufgabe) => (
              // Der Wisch liegt nur auf offenen Aufgaben: Was schon gelöst,
              // gezeigt oder aussortiert ist, hat seinen Ausgang.
              <SwipeRow
                key={aufgabe.id}
                loeschLabel="Gehört nicht dazu"
                disabled={ABGESCHLOSSEN.has(aufgabe.status)}
                onDelete={() => aussortiert.entfernen(aufgabe)}
              >
                <div className="border-linie bg-papier flex items-center gap-2 rounded-[9px] border p-2.5">
                  <Link
                    href={`/tutor/hausaufgabe/${liste.sessionId}/${aufgabe.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-baseline gap-2">
                      {aufgabe.label ? (
                        <span className="text-tinte-leise shrink-0 text-[0.75rem] font-semibold tabular-nums">
                          {aufgabe.label}
                        </span>
                      ) : null}
                      <span className="text-tinte truncate text-[0.8125rem]">{aufgabe.prompt}</span>
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${STATUS_TON[aufgabe.status]}`}
                    >
                      {STATUS_LABEL[aufgabe.status]}
                    </span>
                  </Link>
                </div>
              </SwipeRow>
            ))}
          </ul>
        </Block>
      )}

      {/* Außerhalb des Blocks: `sticky` braucht als Bezug den scrollenden
          Bereich, nicht die Karte drumherum (V-12). */}
      <UndoLoeschen
        verb="aussortiert"
        eintraege={aussortiert.pending.map((a) => ({
          id: a.id,
          label: a.label?.trim() || a.prompt.slice(0, 30),
        }))}
        onZurueck={(id) => aussortiert.zuruecknehmen(id)}
      />
    </div>
  );
}
