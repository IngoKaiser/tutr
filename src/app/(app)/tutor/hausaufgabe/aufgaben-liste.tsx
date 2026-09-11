"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Block, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";

import { ueberspringeAufgabe, type AufgabeSummary, type HausaufgabenListe } from "./actions";

const STATUS_LABEL: Record<AufgabeSummary["status"], string> = {
  offen: "offen",
  in_arbeit: "in Arbeit",
  geloest: "gelöst",
  loesung_gezeigt: "Lösung gezeigt",
  uebersprungen: "übersprungen",
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
  const [aufgaben, setAufgaben] = useState(liste.aufgaben);
  const [pending, startTransition] = useTransition();
  const [ueberspringtId, setUeberspringtId] = useState<string | null>(null);

  function ueberspringen(taskId: string) {
    setUeberspringtId(taskId);
    setAufgaben((prev) =>
      prev.map((a) => (a.id === taskId ? { ...a, status: "uebersprungen" } : a)),
    );
    startTransition(async () => {
      await ueberspringeAufgabe(liste.sessionId, taskId);
      setUeberspringtId(null);
      // Ein Überspringen kann die letzte offene Aufgabe gewesen sein – dann
      // hat der Server gerade den Zweizeiler geschrieben
      // (`pruefeUndErzeugeAbschluss()`). `liste` steckt als Prop fest, ein
      // Neuladen holt ihn.
      router.refresh();
    });
  }

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
              <li key={aufgabe.id}>
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
                  {!ABGESCHLOSSEN.has(aufgabe.status) ? (
                    <button
                      type="button"
                      onClick={() => ueberspringen(aufgabe.id)}
                      disabled={pending && ueberspringtId === aufgabe.id}
                      className="text-tinte-leise hover:text-koenigsblau shrink-0 px-2 py-1 text-[0.75rem] font-medium disabled:opacity-50"
                    >
                      Überspringen
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}
