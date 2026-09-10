"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";
import { prepareImageForUpload } from "@/lib/vocab/image";

import {
  addFromPaste,
  addFromPhoto,
  addManualItem,
  deleteItem,
  updateItem,
  type AddSummary,
  type SetDetail,
  type VocabRow,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Die Vokabelliste eines Sets (V-03a, ADR 0007 D2).
 *
 * Keine Tabelle, kein eigener Review-Screen: eine vertikale Liste, unsichere
 * Zeilen oben (schon so sortiert von `loadSetDetail()`), Antippen klappt zum
 * Bearbeiten auf. Dieselbe Ansicht dient dem Import-Tag wie der Korrektur
 * drei Wochen später – ein Denkmodell.
 */
export function VocabList({
  detail,
  canManage,
  photoAvailable,
}: {
  detail: SetDetail;
  canManage: boolean;
  photoAvailable: boolean;
}) {
  const unsichereAnzahl = detail.items.filter((item) => item.unsicher).length;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={detail.title}
        trailing={detail.subjectName}
        back={{ href: "/faecher/vokabeln", label: "Vokabelsets" }}
      />

      {unsichereAnzahl > 0 ? (
        <Notice>
          {unsichereAnzahl === 1
            ? "1 Zeile solltest du prüfen."
            : `${unsichereAnzahl} Zeilen solltest du prüfen.`}
        </Notice>
      ) : null}

      {canManage ? <AddArea setId={detail.id} photoAvailable={photoAvailable} /> : null}

      {detail.items.length === 0 ? (
        <Notice>Noch keine Vokabeln in diesem Set.</Notice>
      ) : (
        <Block>
          <ul className="flex flex-col gap-2">
            {detail.items.map((item) => (
              <VocabRowItem key={item.id} setId={detail.id} item={item} canManage={canManage} />
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

/** Zustand eines einzelnen Fotos in der Galerie (V-03c). */
type FotoStatus = "wartet" | "verkleinert" | "liest" | "fertig" | "fehler";

type FotoEintrag = {
  id: string;
  file: File;
  /** Objekt-URL fürs Vorschaubild – lebt nur im Tab, wird beim Schließen widerrufen. */
  vorschauUrl: string;
  status: FotoStatus;
  fehler: string | null;
  ergebnis: AddSummary | null;
  /** Handdrehung in Grad (0/90/180/270), aus dem ↻-Knopf – für Seiten, deren
   *  EXIF-Orientierung fehlt oder falsch ist (V-10). */
  rotation: number;
};

/** Exportiert nur für den Komponententest der Foto-Galerie (V-03c). */
export function AddArea({ setId, photoAvailable }: { setId: string; photoAvailable: boolean }) {
  const [mode, setMode] = useState<"geschlossen" | "einfuegen" | "manuell" | "foto">("geschlossen");
  const [pasteText, setPasteText] = useState("");
  const [manualTerm, setManualTerm] = useState("");
  const [manualTranslation, setManualTranslation] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [fotos, setFotos] = useState<FotoEintrag[]>([]);
  const galerieRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  // Widerruft Vorschau-URLs, wenn die Seite verlassen wird, ohne dass
  // "Fertig" gedrückt wurde – sonst bliebe der Speicher bis zum Reload
  // belegt. `fotosRef` trägt den letzten Stand, weil ein Unmount-Effekt nur
  // einmal läuft und dabei den aktuellen Wert braucht, nicht den vom ersten
  // Rendern.
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    };
  }, []);

  function submitPaste() {
    if (!pasteText.trim()) return;
    startTransition(async () => {
      const result = await addFromPaste(setId, pasteText);
      setPasteText("");
      setMode("geschlossen");
      setSummary(result ? summarize(result) : null);
    });
  }

  function submitManual() {
    if (!manualTerm.trim()) return;
    startTransition(async () => {
      await addManualItem(setId, manualTerm, manualTranslation);
      setManualTerm("");
      setManualTranslation("");
    });
  }

  function aktualisiereFoto(id: string, patch: Partial<FotoEintrag>) {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  /**
   * Ein Foto lesen und einspielen (V-03b/V-03c).
   *
   * **Scheitert unabhängig von den anderen** – ein Bild trägt nur seinen
   * eigenen Zustand, kein `return` verwirft mehr die Bilanz der übrigen.
   * Genau das war der Fehler, der einen echten Doppelseiten-Import als
   * „gescheitert" erscheinen ließ, obwohl 60 von 114 Vokabeln längst in der
   * Datenbank standen: Ein `if (!result.ok) return` in der alten Schleife
   * warf die Bilanz des ersten, erfolgreichen Bildes weg, sobald das zweite
   * scheiterte.
   *
   * Direkt aufrufbar für „Nochmal" – dieselbe Funktion, kein eigener
   * Retry-Pfad, weil ein wiederholter Versuch fachlich derselbe Vorgang ist.
   */
  async function verarbeiteFoto(eintrag: FotoEintrag) {
    aktualisiereFoto(eintrag.id, { status: "verkleinert", fehler: null, ergebnis: null });
    try {
      const image = await prepareImageForUpload(eintrag.file, eintrag.rotation);
      aktualisiereFoto(eintrag.id, { status: "liest" });
      const result = await addFromPhoto(setId, image);

      if (!result) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: "Dafür fehlt die Berechtigung." });
        return;
      }
      if (!result.ok) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: result.fehler });
        return;
      }
      aktualisiereFoto(eintrag.id, { status: "fertig", ergebnis: result.summary });
    } catch {
      aktualisiereFoto(eintrag.id, {
        status: "fehler",
        fehler: "Das Bild ließ sich nicht lesen. Versuch es noch einmal.",
      });
    }
  }

  /**
   * Erst sammeln, dann einlesen (V-10). Wie beim Laden aus der Mediathek:
   * mehrere Bilder aufnehmen, einzeln wieder wegnehmen oder drehen, und den
   * Server-Lauf selbst starten – nicht bei jeder Auswahl sofort. Verarbeitet
   * werden nur die noch wartenden; ein Server-Aufruf je Bild (V-03b).
   */
  async function fotosEinlesen() {
    for (const eintrag of fotos) {
      if (eintrag.status === "wartet") await verarbeiteFoto(eintrag);
    }
  }

  function fotosAusgewaehlt(files: File[]) {
    if (files.length === 0) return;
    const neu: FotoEintrag[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      vorschauUrl: URL.createObjectURL(file),
      status: "wartet",
      fehler: null,
      ergebnis: null,
      rotation: 0,
    }));
    setFotos((prev) => [...prev, ...neu]);
  }

  /** Ein wartendes oder gescheitertes Bild wieder wegnehmen, bevor eingelesen wird. */
  function fotoEntfernen(id: string) {
    setFotos((prev) => {
      const raus = prev.find((f) => f.id === id);
      if (raus) URL.revokeObjectURL(raus.vorschauUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  /** Ein Bild um 90° weiterdrehen – für Seiten, deren Ausrichtung nicht stimmt. */
  function fotoDrehen(id: string) {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, rotation: f.rotation + 90 } : f)));
  }

  /**
   * Galerie schließen: Bilanz über alle erfolgreichen Bilder, Vorschauen
   * widerrufen (ADR 0007 D6 – die Fotos werden nirgends aufgehoben). Fotos,
   * die noch verarbeitet werden, bleiben nicht liegen: Wer schließt, während
   * eins noch läuft, sieht dessen Ergebnis nicht mehr – das Feld ist bewusst
   * deaktiviert, solange `verarbeitungLaeuft` gilt (siehe unten).
   */
  function fotosSchliessen() {
    const erfolge = fotos.filter((f) => f.ergebnis !== null);
    const gesamt = erfolge.reduce<AddSummary>(
      (acc, f) => ({
        neu: acc.neu + (f.ergebnis?.neu ?? 0),
        verknuepft: acc.verknuepft + (f.ergebnis?.verknuepft ?? 0),
        zuPruefen: acc.zuPruefen + (f.ergebnis?.zuPruefen ?? 0),
      }),
      { neu: 0, verknuepft: 0, zuPruefen: 0 },
    );
    for (const f of fotos) URL.revokeObjectURL(f.vorschauUrl);
    setFotos([]);
    setSummary(erfolge.length > 0 ? summarize(gesamt) : null);
    setMode("geschlossen");
  }

  const verarbeitungLaeuft = fotos.some((f) => f.status === "verkleinert" || f.status === "liest");
  const wartende = fotos.filter((f) => f.status === "wartet").length;

  if (mode === "geschlossen") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMode("foto")}>Foto</Button>
        <Button quiet onClick={() => setMode("einfuegen")}>
          Einfügen
        </Button>
        <Button quiet onClick={() => setMode("manuell")}>
          Von Hand
        </Button>
        {summary ? <Notice>{summary}</Notice> : null}
      </div>
    );
  }

  if (mode === "foto") {
    return (
      <Block title="Vokabeln abfotografieren">
        {photoAvailable ? (
          <>
            <Notice>
              Buchseite, Arbeitsblatt oder Vokabelheft. Erst so viele Bilder aufnehmen oder laden,
              wie du brauchst – eine Vokabelliste läuft oft über eine Doppelseite –, dann
              „Einlesen“. Vorher lässt sich jedes Bild noch drehen oder wieder wegnehmen. Jedes Bild
              zählt für sich: Scheitert eins, bleiben die anderen. Die Fotos werden nicht
              gespeichert.
            </Notice>

            {/* Ein Eingabefeld, zwei Knöpfe (ADR 0007 D1): dasselbe `accept`,
                einmal mit und einmal ohne `capture`. Am Handy öffnet das eine
                die Kamera, das andere die Mediathek; am Rechner ist `capture`
                wirkungslos und beide führen zur Dateiauswahl. */}
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
              <Button
                quiet
                onClick={() => kameraRef.current?.click()}
                disabled={verarbeitungLaeuft}
              >
                Kamera
              </Button>
              <Button
                quiet
                onClick={() => galerieRef.current?.click()}
                disabled={verarbeitungLaeuft}
              >
                Bild auswählen
              </Button>
              {wartende > 0 ? (
                <Button onClick={() => void fotosEinlesen()} disabled={verarbeitungLaeuft}>
                  {verarbeitungLaeuft
                    ? "Wird eingelesen …"
                    : wartende === 1
                      ? "Einlesen"
                      : `Einlesen (${wartende})`}
                </Button>
              ) : null}
              <Button quiet onClick={fotosSchliessen} disabled={verarbeitungLaeuft}>
                {fotos.some((f) => f.ergebnis !== null) ? "Fertig" : "Abbrechen"}
              </Button>
            </div>

            {fotos.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {fotos.map((foto, index) => (
                  <FotoZeile
                    key={foto.id}
                    nummer={index + 1}
                    foto={foto}
                    onNochmal={() => void verarbeiteFoto(foto)}
                    onDrehen={() => fotoDrehen(foto.id)}
                    onEntfernen={() => fotoEntfernen(foto.id)}
                  />
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <Notice>
              Die Bilderkennung ist auf diesem Gerät nicht eingerichtet. Einfügen und Tippen
              funktionieren weiterhin.
            </Notice>
            <Button quiet onClick={() => setMode("geschlossen")}>
              Zurück
            </Button>
          </>
        )}
      </Block>
    );
  }

  if (mode === "einfuegen") {
    return (
      <Block title="Vokabeln einfügen">
        <Notice>
          Aus Excel, Google Sheets oder einer getippten Liste – eine Vokabel je Zeile, Wort und
          Übersetzung getrennt durch Tab, Semikolon, Komma oder einen Gedankenstrich.
        </Notice>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          autoFocus
          rows={8}
          placeholder={"aller\tgehen\nvenir\tkommen"}
          className={`${FIELD} font-mono`}
        />
        <div className="flex gap-2">
          <Button onClick={submitPaste} disabled={pending || !pasteText.trim()}>
            {pending ? "Einen Moment …" : "Übernehmen"}
          </Button>
          <Button quiet onClick={() => setMode("geschlossen")} disabled={pending}>
            Abbrechen
          </Button>
        </div>
      </Block>
    );
  }

  return (
    <Block title="Vokabel von Hand">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitManual();
        }}
        className="flex flex-col gap-2.5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Wort</span>
          <input
            value={manualTerm}
            onChange={(e) => setManualTerm(e.target.value)}
            autoFocus
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Übersetzung</span>
          <input
            value={manualTranslation}
            onChange={(e) => setManualTranslation(e.target.value)}
            className={FIELD}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !manualTerm.trim()}>
            {pending ? "Einen Moment …" : "Hinzufügen"}
          </Button>
          <Button quiet type="button" onClick={() => setMode("geschlossen")} disabled={pending}>
            Fertig
          </Button>
        </div>
      </form>
    </Block>
  );
}

function summarize(result: { neu: number; verknuepft: number; zuPruefen: number }): string {
  const teile: string[] = [];
  if (result.neu > 0) teile.push(`${result.neu} neu`);
  if (result.verknuepft > 0) teile.push(`${result.verknuepft} schon vorhanden, nur verknüpft`);
  if (result.zuPruefen > 0) teile.push(`${result.zuPruefen} zu prüfen`);
  return teile.length > 0 ? teile.join(", ") + "." : "Nichts übernommen.";
}

/** Der Text unter der Miniatur – der Zustand ist immer benannt, nie ein Spinner allein. */
function fotoStatusText(foto: FotoEintrag): string {
  switch (foto.status) {
    case "wartet":
      return "wartet …";
    case "verkleinert":
      return "Bild wird verkleinert …";
    case "liest":
      return "Vokabeln werden gelesen …";
    case "fertig":
      return foto.ergebnis ? summarize(foto.ergebnis) : "Nichts übernommen.";
    case "fehler":
      return foto.fehler ?? "Das hat nicht geklappt.";
  }
}

/**
 * Eine Kachel je Foto (V-03c) – die Minigalerie aus der Auswertung des
 * Doppelseiten-Imports vom 9. September. Trägt ihren eigenen Zustand, damit
 * sichtbar bleibt, welches Bild schon ausgewertet ist und welches noch
 * einen Versuch braucht, statt eines einzigen Fortschrittstexts für alle
 * Bilder zusammen.
 */
function FotoZeile({
  nummer,
  foto,
  onNochmal,
  onDrehen,
  onEntfernen,
}: {
  nummer: number;
  foto: FotoEintrag;
  onNochmal: () => void;
  onDrehen: () => void;
  onEntfernen: () => void;
}) {
  const istFehler = foto.status === "fehler";
  const istFertig = foto.status === "fertig";
  // Vor dem Einlesen (oder nach einem Fehler) lässt sich das Bild noch
  // drehen und wegnehmen – währenddessen und danach nicht mehr.
  const bearbeitbar = foto.status === "wartet" || istFehler;
  return (
    <li
      className={`flex items-center gap-3 rounded-[9px] border px-3 py-2.5 ${
        istFehler ? "border-offen bg-offen-hell" : "border-linie bg-papier"
      }`}
    >
      {/* Objekt-URL im Speicher des Tabs – dasselbe Bild, das an die
          Bilderkennung ging, nie das Original in voller Größe (`image.ts`
          verkleinert vor dem Hochladen, hier zeigt die Vorschau die
          Originaldatei, weil das für eine Miniatur ohnehin reicht). Die
          Drehung ist hier nur Vorschau; die echte Drehung passiert in
          `prepareImageForUpload()`. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Objekt-URL aus lokaler Datei, kein Next-Bildoptimierer nötig */}
      <img
        src={foto.vorschauUrl}
        alt=""
        style={{ transform: `rotate(${foto.rotation}deg)` }}
        className="border-linie h-12 w-12 shrink-0 rounded-md border object-cover transition-transform"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wide uppercase">
          Bild {nummer}
        </span>
        <span
          className={`text-[0.8125rem] ${
            istFehler
              ? "text-offen font-medium"
              : istFertig
                ? "text-sicher font-medium"
                : "text-tinte-weich"
          }`}
        >
          {fotoStatusText(foto)}
        </span>
      </div>
      {istFehler ? (
        <button
          type="button"
          onClick={onNochmal}
          className="text-koenigsblau shrink-0 text-[0.8125rem] font-medium underline underline-offset-2"
        >
          Nochmal
        </button>
      ) : null}
      {bearbeitbar ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDrehen}
            aria-label={`Bild ${nummer} drehen`}
            className="text-tinte-leise hover:text-koenigsblau rounded p-1 text-base leading-none"
          >
            <span aria-hidden="true">↻</span>
          </button>
          <button
            type="button"
            onClick={onEntfernen}
            aria-label={`Bild ${nummer} entfernen`}
            className="text-tinte-leise hover:text-offen rounded p-1 text-base leading-none"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ) : null}
    </li>
  );
}

function VocabRowItem({
  setId,
  item,
  canManage,
}: {
  setId: string;
  item: VocabRow;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(item.term);
  const [translation, setTranslation] = useState(item.translation);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <li>
        <button
          type="button"
          onClick={() => canManage && setOpen(true)}
          disabled={!canManage}
          className={`flex w-full items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5 text-left disabled:cursor-default ${
            item.unsicher
              ? "border-offen bg-offen-hell"
              : "border-linie bg-papier hover:bg-papier-tief"
          }`}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-tinte truncate text-[0.8125rem] font-medium">
              {item.term || "(kein Wort)"}
            </span>
            <span className="text-tinte-leise truncate text-[0.75rem]">
              {item.translation || "(keine Übersetzung)"}
            </span>
          </span>
          {item.unsicher ? (
            <span className="text-offen shrink-0 text-[0.6875rem] font-semibold">prüfen</span>
          ) : null}
        </button>
      </li>
    );
  }

  function save() {
    startTransition(async () => {
      await updateItem(setId, item.id, term, translation);
      setOpen(false);
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteItem(setId, item.id);
    });
  }

  return (
    <li className="border-koenigsblau bg-koenigsblau-hell flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Wort</span>
        <input value={term} onChange={(e) => setTerm(e.target.value)} className={FIELD} autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Übersetzung</span>
        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          className={FIELD}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "…" : "Speichern"}
        </Button>
        <Button quiet onClick={() => setOpen(false)} disabled={pending}>
          Abbrechen
        </Button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-tinte-leise hover:text-offen ml-auto text-xs font-medium disabled:opacity-50"
        >
          Das ist keine Vokabel – löschen
        </button>
      </div>
    </li>
  );
}
