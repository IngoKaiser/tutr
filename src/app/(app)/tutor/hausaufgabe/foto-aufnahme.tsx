"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Block, Button, ContextChip, Notice, PageHeader } from "@/components/shell/primitives";
import { prepareImageForUpload } from "@/lib/image";

import { fotoZuAufgaben, starteHausaufgabe } from "./actions";

const NICHT_EINGERICHTET =
  "Der Hausaufgaben-Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

/** Zustand eines einzelnen Fotos (dieselbe Idee wie `vocab-list.tsx`s Foto-Galerie, V-03c). */
type FotoStatus = "wartet" | "verkleinert" | "liest" | "fertig" | "fehler";

type FotoEintrag = {
  id: string;
  file: File;
  vorschauUrl: string;
  status: FotoStatus;
  fehler: string | null;
  erkannt: number | null;
  rotation: number;
};

/**
 * Foto → Aufgabenliste (T-03 PR 2, §4a Schritt 1).
 *
 * Bewusst kein „Modus"-Umschalter wie bei den Vokabeln: Diese Seite **ist**
 * schon der Foto-Schritt, es gibt hier nichts Einzufügen oder von Hand
 * einzutippen – eine Hausaufgabe kommt immer vom Blatt.
 *
 * Die Session entsteht erst beim ersten Klick auf „Aufgaben einlesen"
 * (`sessionIdRef`), nicht beim Rendern – sonst hinterließe ein Reload dieser
 * Seite jedes Mal eine leere Session.
 */
export function FotoAufnahme({
  subjectId,
  subjectName,
  available,
}: {
  subjectId: string;
  subjectName: string;
  available: boolean;
}) {
  const router = useRouter();
  const [fotos, setFotos] = useState<FotoEintrag[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [anlegeFehler, setAnlegeFehler] = useState<string | null>(null);
  const [wirdWeitergeleitet, setWirdWeitergeleitet] = useState(false);
  const galerieRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);

  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    };
  }, []);

  function aktualisiereFoto(id: string, patch: Partial<FotoEintrag>) {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function fotosAusgewaehlt(files: File[]) {
    if (files.length === 0) return;
    const neu: FotoEintrag[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      vorschauUrl: URL.createObjectURL(file),
      status: "wartet",
      fehler: null,
      erkannt: null,
      rotation: 0,
    }));
    setFotos((prev) => [...prev, ...neu]);
  }

  function fotoEntfernen(id: string) {
    setFotos((prev) => {
      const raus = prev.find((f) => f.id === id);
      if (raus) URL.revokeObjectURL(raus.vorschauUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  function fotoDrehen(id: string) {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, rotation: f.rotation + 90 } : f)));
  }

  /** Ein Foto einlesen. Scheitert unabhängig von den anderen (wie bei den Vokabeln, V-03c). */
  async function verarbeiteFoto(eintrag: FotoEintrag, sid: string) {
    aktualisiereFoto(eintrag.id, { status: "verkleinert", fehler: null, erkannt: null });
    try {
      const image = await prepareImageForUpload(eintrag.file, eintrag.rotation);
      aktualisiereFoto(eintrag.id, { status: "liest" });
      const result = await fotoZuAufgaben(sid, image);

      if (!result) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: "Dafür fehlt die Berechtigung." });
        return;
      }
      if (!result.ok) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: result.fehler });
        return;
      }
      aktualisiereFoto(eintrag.id, { status: "fertig", erkannt: result.erkannt });
    } catch {
      aktualisiereFoto(eintrag.id, {
        status: "fehler",
        fehler: "Das Bild ließ sich nicht lesen. Versuch es noch einmal.",
      });
    }
  }

  /** Legt bei Bedarf die Session an, dann ein Server-Aufruf je wartendem Foto. */
  async function aufgabenEinlesen() {
    setAnlegeFehler(null);
    let sid = sessionId;
    if (!sid) {
      const start = await starteHausaufgabe(subjectId);
      if (!start) {
        setAnlegeFehler("Diese Hausaufgabe ließ sich nicht anlegen. Versuch es noch einmal.");
        return;
      }
      sid = start.sessionId;
      setSessionId(sid);
    }
    for (const eintrag of fotosRef.current) {
      if (eintrag.status === "wartet") await verarbeiteFoto(eintrag, sid);
    }
  }

  function weiterZurListe() {
    if (!sessionId) return;
    setWirdWeitergeleitet(true);
    for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    router.push(`/tutor/hausaufgabe/${sessionId}`);
  }

  if (!available) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Hausaufgabe" back={{ href: "/tutor", label: "Tutor" }} />
        <Notice>{NICHT_EINGERICHTET}</Notice>
      </div>
    );
  }

  const verarbeitungLaeuft = fotos.some((f) => f.status === "verkleinert" || f.status === "liest");
  const wartende = fotos.filter((f) => f.status === "wartet").length;
  const erfolgreich = fotos.filter((f) => f.status === "fertig").length;
  const gesamtErkannt = fotos.reduce((summe, f) => summe + (f.erkannt ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Hausaufgabe" back={{ href: "/tutor", label: "Tutor" }} />
      <ContextChip subject={subjectName} />

      <Block title="Aufgaben abfotografieren">
        <Notice>
          Buchseite, Arbeitsblatt oder Hefteintrag. Erst so viele Bilder aufnehmen oder laden, wie
          nötig sind – eine Doppelseite läuft oft über zwei Fotos –, dann „Aufgaben einlesen&ldquo;.
          Vorher lässt sich jedes Bild noch drehen oder wieder wegnehmen. Die Fotos werden nicht
          gespeichert.
        </Notice>

        <input
          ref={kameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            fotosAusgewaehlt(files);
          }}
        />
        <input
          ref={galerieRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            fotosAusgewaehlt(files);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button quiet onClick={() => kameraRef.current?.click()} disabled={verarbeitungLaeuft}>
            Kamera
          </Button>
          <Button quiet onClick={() => galerieRef.current?.click()} disabled={verarbeitungLaeuft}>
            Bild auswählen
          </Button>
          {wartende > 0 ? (
            <Button onClick={() => void aufgabenEinlesen()} disabled={verarbeitungLaeuft}>
              {verarbeitungLaeuft
                ? "Liest …"
                : `Aufgaben einlesen (${wartende} ${wartende === 1 ? "Bild" : "Bilder"})`}
            </Button>
          ) : null}
        </div>

        {anlegeFehler ? <Notice>{anlegeFehler}</Notice> : null}

        {fotos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fotos.map((f) => (
              <FotoZeile
                key={f.id}
                eintrag={f}
                onEntfernen={() => fotoEntfernen(f.id)}
                onDrehen={() => fotoDrehen(f.id)}
                onNochmal={sessionId ? () => void verarbeiteFoto(f, sessionId) : undefined}
              />
            ))}
          </ul>
        ) : null}

        {erfolgreich > 0 && !verarbeitungLaeuft ? (
          <div className="flex flex-col gap-2">
            <Notice>
              {gesamtErkannt} {gesamtErkannt === 1 ? "Aufgabe" : "Aufgaben"} erkannt.
            </Notice>
            <Button onClick={weiterZurListe} disabled={wirdWeitergeleitet}>
              Zur Aufgabenliste
            </Button>
          </div>
        ) : null}
      </Block>
    </div>
  );
}

function FotoZeile({
  eintrag,
  onEntfernen,
  onDrehen,
  onNochmal,
}: {
  eintrag: FotoEintrag;
  onEntfernen: () => void;
  onDrehen: () => void;
  onNochmal: (() => void) | undefined;
}) {
  const darfAendern = eintrag.status === "wartet" || eintrag.status === "fehler";
  return (
    <li className="border-linie bg-flaeche flex items-center gap-3 rounded-[9px] border p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- Objekt-URL aus lokaler Datei, kein Next-Bildoptimierer nötig */}
      <img
        src={eintrag.vorschauUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-md object-cover"
        style={{ transform: `rotate(${eintrag.rotation}deg)` }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-tinte truncate text-[0.8125rem] font-medium">{eintrag.file.name}</div>
        <div className="text-tinte-leise text-[0.75rem]">
          {eintrag.status === "wartet" && "Wartet"}
          {eintrag.status === "verkleinert" && "Wird verkleinert …"}
          {eintrag.status === "liest" && "Liest die Aufgaben …"}
          {eintrag.status === "fertig" &&
            `${eintrag.erkannt} ${eintrag.erkannt === 1 ? "Aufgabe" : "Aufgaben"} erkannt`}
          {eintrag.status === "fehler" && eintrag.fehler}
        </div>
      </div>
      {darfAendern ? (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onDrehen}
            aria-label="Bild drehen"
            className="text-tinte-leise hover:text-koenigsblau flex h-8 w-8 items-center justify-center rounded-md text-sm"
          >
            ↻
          </button>
          {eintrag.status === "fehler" && onNochmal ? (
            <button
              type="button"
              onClick={onNochmal}
              className="text-koenigsblau px-1.5 text-[0.75rem] font-medium"
            >
              Nochmal
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEntfernen}
            aria-label="Foto entfernen"
            className="text-tinte-leise hover:text-offen flex h-8 w-8 items-center justify-center rounded-md text-sm"
          >
            ✕
          </button>
        </div>
      ) : null}
    </li>
  );
}
