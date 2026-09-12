"use client";

import { useEffect, useRef, useState } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";
import type { CalendarImportDraft } from "@/lib/calendar/import-draft";
import { prepareImageForUpload } from "@/lib/image";

import { dateiZuKlausurplan, fotoZuKlausurplan, type ImportQuelle } from "./actions";
import { ReviewListe } from "./review-liste";

const DB_NICHT_EINGERICHTET =
  "Der Klausurplan-Import ist auf diesem Gerät nicht eingerichtet. Termine von Hand eintragen funktioniert weiter.";

/** Nur der Foto-Kanal braucht Claude Vision – Datei-Import (K-04, ADR 0016 D4) nicht. */
const BILD_NICHT_EINGERICHTET =
  "Die Bilderkennung ist auf diesem Gerät nicht eingerichtet. Termine von Hand eintragen oder aus einer Datei einlesen funktioniert weiter.";

/** Zustand eines einzelnen Fotos – dieselbe Idee wie bei der Hausaufgabe (`foto-aufnahme.tsx`, V-10). */
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

/** ArrayBuffer → Base64, ohne die ganze Datei in einem `String.fromCharCode(...)`-Aufruf zu entpacken (Stack-Limit). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binaer = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binaer);
}

/**
 * Bild- **und** Datei-Import Klausurplan (K-03/K-04, §6 M7, ADR 0016). Eine
 * Kanalwahl vor den bisherigen Phasen, danach wie gehabt: sammeln/einlesen,
 * dann die kanalneutrale Review-Liste (K-02c) – kein zweiter URL-Schritt,
 * weil es dazwischen nichts Gespeichertes gibt, an das sich einer hängen
 * könnte (Entwürfe leben laut ADR 0016 D2 bewusst nur in React-State).
 *
 * `dbVerfuegbar`/`bildVerfuegbar` getrennt (K-04): Ohne `ANTHROPIC_API_KEY`
 * geht nur der Foto-Kanal nicht – der Datei-Kanal braucht keinen
 * Modellaufruf (ADR 0016 D4) und bleibt nutzbar.
 */
export function KlausurplanEinlesen({
  dbVerfuegbar,
  bildVerfuegbar,
}: {
  dbVerfuegbar: boolean;
  bildVerfuegbar: boolean;
}) {
  const [phase, setPhase] = useState<"wahl" | "fotos" | "datei" | "review">("wahl");
  const [fotos, setFotos] = useState<FotoEintrag[]>([]);
  const [drafts, setDrafts] = useState<CalendarImportDraft[]>([]);
  const [quelle, setQuelle] = useState<ImportQuelle>("bild");
  const galerieRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  const [dateiName, setDateiName] = useState<string | null>(null);
  const [dateiStatus, setDateiStatus] = useState<"liest" | "fertig" | "fehler" | null>(null);
  const [dateiFehler, setDateiFehler] = useState<string[]>([]);
  const [dateiErkannt, setDateiErkannt] = useState(0);

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

  /** Ein Foto einlesen. Scheitert unabhängig von den anderen (wie V-03c). */
  async function verarbeiteFoto(eintrag: FotoEintrag) {
    aktualisiereFoto(eintrag.id, { status: "verkleinert", fehler: null, erkannt: null });
    try {
      const image = await prepareImageForUpload(eintrag.file, eintrag.rotation);
      aktualisiereFoto(eintrag.id, { status: "liest" });
      const result = await fotoZuKlausurplan(image);

      if (!result) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: "Dafür fehlt die Berechtigung." });
        return;
      }
      if (!result.ok) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: result.fehler });
        return;
      }
      aktualisiereFoto(eintrag.id, { status: "fertig", erkannt: result.drafts.length });
      setDrafts((prev) => [...prev, ...result.drafts]);
    } catch {
      aktualisiereFoto(eintrag.id, {
        status: "fehler",
        fehler: "Das Bild ließ sich nicht lesen. Versuch es noch einmal.",
      });
    }
  }

  async function planEinlesen() {
    for (const eintrag of fotosRef.current) {
      if (eintrag.status === "wartet") await verarbeiteFoto(eintrag);
    }
  }

  function weiterZurUebersicht() {
    for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    setPhase("review");
  }

  /** Eine Datei einlesen (K-04): CSV/ICS als Text, XLSX als Base64 (Binärformat). */
  async function dateiVerarbeiten(file: File) {
    setDateiName(file.name);
    setDateiStatus("liest");
    setDateiFehler([]);
    setDateiErkannt(0);
    try {
      const istXlsx = file.name.toLowerCase().endsWith(".xlsx");
      const input = istXlsx
        ? { name: file.name, base64: arrayBufferToBase64(await file.arrayBuffer()) }
        : { name: file.name, text: await file.text() };

      const result = await dateiZuKlausurplan(input);
      if (!result) {
        setDateiStatus("fehler");
        setDateiFehler(["Dafür fehlt die Berechtigung."]);
        return;
      }
      if (!result.ok) {
        setDateiStatus("fehler");
        setDateiFehler([result.fehler]);
        return;
      }
      setDateiStatus("fertig");
      setDateiFehler(result.fehler);
      setDateiErkannt(result.drafts.length);
      setDrafts(result.drafts);
    } catch {
      setDateiStatus("fehler");
      setDateiFehler(["Die Datei ließ sich nicht lesen. Versuch es noch einmal."]);
    }
  }

  if (!dbVerfuegbar) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Klausurplan einlesen"
          back={{ href: "/pruefungen", label: "Prüfungen" }}
        />
        <Notice>{DB_NICHT_EINGERICHTET}</Notice>
      </div>
    );
  }

  if (phase === "review") {
    return <ReviewListe drafts={drafts} quelle={quelle} />;
  }

  if (phase === "wahl") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Klausurplan einlesen"
          back={{ href: "/pruefungen", label: "Prüfungen" }}
        />
        <Block title="Woher kommt der Plan?">
          <Notice>
            Aus einem Foto (Aushang, Schulportal-Ausdruck) oder aus einer Datei (Export aus
            SchulDock o.&nbsp;Ä. als CSV, Excel oder Kalenderdatei). Beides landet danach in
            derselben Übersicht – nichts wird gespeichert, bevor du es dort bestätigst.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setQuelle("bild");
                setPhase("fotos");
              }}
            >
              Foto
            </Button>
            <Button
              quiet
              onClick={() => {
                setQuelle("datei");
                setPhase("datei");
              }}
            >
              Datei
            </Button>
          </div>
        </Block>
      </div>
    );
  }

  if (phase === "datei") {
    const laeuft = dateiStatus === "liest";
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Klausurplan einlesen"
          back={{ href: "/pruefungen", label: "Prüfungen" }}
        />
        <Block title="Datei auswählen">
          <Notice>
            CSV, Excel (.xlsx) oder eine Kalenderdatei (.ics) – z.&nbsp;B. der SchulDock-Export.
          </Notice>
          <input
            ref={dateiRef}
            type="file"
            accept=".csv,.xlsx,.ics,.ical"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void dateiVerarbeiten(file);
            }}
          />
          <Button quiet onClick={() => dateiRef.current?.click()} disabled={laeuft}>
            {laeuft ? "Liest …" : "Datei wählen"}
          </Button>
          {dateiName ? (
            <Notice>
              {dateiName}
              {dateiStatus === "fertig"
                ? ` – ${dateiErkannt} ${dateiErkannt === 1 ? "Zeile" : "Zeilen"} erkannt`
                : ""}
            </Notice>
          ) : null}
          {dateiFehler.map((f, i) => (
            <Notice key={i}>{f}</Notice>
          ))}
          {dateiStatus === "fertig" && dateiErkannt > 0 ? (
            <Button onClick={() => setPhase("review")}>Zur Übersicht</Button>
          ) : null}
        </Block>
      </div>
    );
  }

  // phase === "fotos": eigenes Gate, nicht das ganze Bauteil (K-04) – der
  // Datei-Kanal braucht `ANTHROPIC_API_KEY` nicht.
  if (!bildVerfuegbar) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Klausurplan einlesen"
          back={{ href: "/pruefungen", label: "Prüfungen" }}
        />
        <Notice>{BILD_NICHT_EINGERICHTET}</Notice>
      </div>
    );
  }

  const verarbeitungLaeuft = fotos.some((f) => f.status === "verkleinert" || f.status === "liest");
  const wartende = fotos.filter((f) => f.status === "wartet").length;
  const erfolgreich = fotos.filter((f) => f.status === "fertig").length;
  const gesamtErkannt = fotos.reduce((summe, f) => summe + (f.erkannt ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Klausurplan einlesen" back={{ href: "/pruefungen", label: "Prüfungen" }} />

      <Block title="Plan abfotografieren">
        <Notice>
          Aushang, Schulportal-Ausdruck oder Tabelle. Erst so viele Bilder aufnehmen oder laden, wie
          nötig sind, dann „Einlesen&ldquo;. Vorher lässt sich jedes Bild noch drehen oder wieder
          wegnehmen. Die Fotos werden nicht gespeichert, und es landet noch nichts im Kalender – das
          entscheidest du danach in der Übersicht.
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
            <Button onClick={() => void planEinlesen()} disabled={verarbeitungLaeuft}>
              {verarbeitungLaeuft
                ? "Liest …"
                : `Einlesen (${wartende} ${wartende === 1 ? "Bild" : "Bilder"})`}
            </Button>
          ) : null}
        </div>

        {fotos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fotos.map((f) => (
              <FotoZeile
                key={f.id}
                eintrag={f}
                onEntfernen={() => fotoEntfernen(f.id)}
                onDrehen={() => fotoDrehen(f.id)}
                onNochmal={() => void verarbeiteFoto(f)}
              />
            ))}
          </ul>
        ) : null}

        {erfolgreich > 0 && !verarbeitungLaeuft ? (
          <div className="flex flex-col gap-2">
            <Notice>
              {gesamtErkannt} {gesamtErkannt === 1 ? "Zeile" : "Zeilen"} erkannt.
            </Notice>
            <Button onClick={weiterZurUebersicht}>Zur Übersicht</Button>
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
  onNochmal: () => void;
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
          {eintrag.status === "liest" && "Liest den Plan …"}
          {eintrag.status === "fertig" &&
            `${eintrag.erkannt} ${eintrag.erkannt === 1 ? "Zeile" : "Zeilen"} erkannt`}
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
          {eintrag.status === "fehler" ? (
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
