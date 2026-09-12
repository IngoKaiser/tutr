"use client";

import { useEffect, useRef, useState } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";
import { prepareImageForUpload } from "@/lib/image";

import {
  aktualisiereEigenesLehrwerk,
  entferneZuordnung,
  leseKapitelAusFoto,
  ordneVorhandenesLehrwerkZu,
  speichereNeuesLehrwerk,
  type LehrwerkChapter,
  type LehrwerkKontext,
  type NeuesLehrwerkInput,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";
const MINI_BUTTON =
  "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";

const NICHT_EINGERICHTET =
  "Auf diesem Gerät nicht eingerichtet. Ein vorhandenes Lehrwerk zuordnen funktioniert weiter.";

type Sicht = "uebersicht" | "kandidaten" | "foto" | "review";

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

type EntwurfKapitel = { id: string; titel: string; seiten: string };

type Entwurf = {
  titel: string;
  verlag: string;
  jahrgangsstufe: string;
  kapitel: EntwurfKapitel[];
  quelle: "foto";
  /** Gesetzt, wenn ein **eigenes** Lehrwerk bearbeitet statt neu angelegt wird. */
  bearbeitetTextbookId: string | null;
};

function leererEntwurf(): Entwurf {
  return {
    titel: "",
    verlag: "",
    jahrgangsstufe: "",
    kapitel: [],
    quelle: "foto",
    bearbeitetTextbookId: null,
  };
}

function kapitelZeile(k: LehrwerkChapter): EntwurfKapitel {
  return { id: crypto.randomUUID(), titel: k.titel, seiten: k.seiten ?? "" };
}

/**
 * Lehrwerk pro Fach erfassen (L-01, §7/§10, ADR 0009 Nachtrag 12.9.2026).
 *
 * Die Websuche ist mit L-02 wieder raus (eine Suche kostete real 0,37–0,51 $,
 * mehr als der gesamte Stundendeckel – `docs/PLAN.md`). Übrig bleibt **ein**
 * Erfassungsweg (Foto) in **eine** editierbare Kapitelliste
 * (`sicht === "review"`) – das deckt „manuell" weiterhin mit ab, ohne einen
 * eigenen Weg zu bauen: Wer nichts fotografiert, öffnet dieselbe Liste leer
 * und trägt Kapitel von Hand ein.
 */
export function LehrwerkVerwalten({
  kontext,
  fotoVerfuegbar,
}: {
  kontext: LehrwerkKontext;
  fotoVerfuegbar: boolean;
}) {
  const [sicht, setSicht] = useState<Sicht>("uebersicht");
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [aktionLaeuft, setAktionLaeuft] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);

  const [fotos, setFotos] = useState<FotoEintrag[]>([]);
  const fotosRef = useRef(fotos);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    };
  }, []);

  const galerieRef = useRef<HTMLInputElement>(null);
  const kameraRef = useRef<HTMLInputElement>(null);

  const back = { href: "/faecher", label: "Fächer" };

  async function zuordnen(textbookId: string) {
    setAktionFehler(null);
    setAktionLaeuft(true);
    const result = await ordneVorhandenesLehrwerkZu(kontext.subjectId, textbookId);
    setAktionLaeuft(false);
    if (!result) return setAktionFehler("Dafür fehlt die Berechtigung.");
    if (!result.ok) return setAktionFehler(result.fehler);
    setSicht("uebersicht");
  }

  async function entfernen() {
    setAktionFehler(null);
    setAktionLaeuft(true);
    const ok = await entferneZuordnung(kontext.subjectId);
    setAktionLaeuft(false);
    if (!ok) return setAktionFehler("Dafür fehlt die Berechtigung.");
    setSicht("uebersicht");
  }

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

  /** Ein Foto einlesen. Scheitert unabhängig von den anderen (wie beim Klausurplan-Import). */
  async function verarbeiteFoto(eintrag: FotoEintrag) {
    aktualisiereFoto(eintrag.id, { status: "verkleinert", fehler: null, erkannt: null });
    try {
      const image = await prepareImageForUpload(eintrag.file, eintrag.rotation);
      aktualisiereFoto(eintrag.id, { status: "liest" });
      const result = await leseKapitelAusFoto(image, kontext.subjectName);
      if (!result) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: "Dafür fehlt die Berechtigung." });
        return;
      }
      if (!result.ok) {
        aktualisiereFoto(eintrag.id, { status: "fehler", fehler: result.fehler });
        return;
      }
      aktualisiereFoto(eintrag.id, { status: "fertig", erkannt: result.kapitel.length });
      setEntwurf((prev) => {
        const basis = prev ?? leererEntwurf();
        return {
          ...basis,
          titel: basis.titel || result.titel || "",
          verlag: basis.verlag || result.verlag || "",
          jahrgangsstufe: basis.jahrgangsstufe || (result.jahrgangsstufe?.toString() ?? ""),
          kapitel: [...basis.kapitel, ...result.kapitel.map(kapitelZeile)],
        };
      });
    } catch {
      aktualisiereFoto(eintrag.id, {
        status: "fehler",
        fehler: "Das Bild ließ sich nicht lesen. Versuch es noch einmal.",
      });
    }
  }

  async function fotosEinlesen() {
    for (const eintrag of fotosRef.current) {
      if (eintrag.status === "wartet") await verarbeiteFoto(eintrag);
    }
  }

  function bearbeiten() {
    if (!kontext.zugewiesen) return;
    setEntwurf({
      titel: kontext.zugewiesen.titel,
      verlag: kontext.zugewiesen.verlag ?? "",
      jahrgangsstufe: kontext.zugewiesen.jahrgangsstufe?.toString() ?? "",
      kapitel: kontext.zugewiesen.kapitel.map(kapitelZeile),
      quelle: "foto",
      bearbeitetTextbookId: kontext.zugewiesen.textbookId,
    });
    setSicht("review");
  }

  function weiterZurKapitelliste() {
    for (const f of fotosRef.current) URL.revokeObjectURL(f.vorschauUrl);
    setEntwurf((prev) => prev ?? leererEntwurf());
    setSicht("review");
  }

  function kapitelAendern(id: string, patch: Partial<EntwurfKapitel>) {
    setEntwurf((prev) =>
      prev
        ? { ...prev, kapitel: prev.kapitel.map((k) => (k.id === id ? { ...k, ...patch } : k)) }
        : prev,
    );
  }

  function kapitelEntfernen(id: string) {
    setEntwurf((prev) =>
      prev ? { ...prev, kapitel: prev.kapitel.filter((k) => k.id !== id) } : prev,
    );
  }

  function kapitelVerschieben(id: string, richtung: -1 | 1) {
    setEntwurf((prev) => {
      if (!prev) return prev;
      const index = prev.kapitel.findIndex((k) => k.id === id);
      const ziel = index + richtung;
      if (index < 0 || ziel < 0 || ziel >= prev.kapitel.length) return prev;
      const kapitel = [...prev.kapitel];
      [kapitel[index], kapitel[ziel]] = [kapitel[ziel]!, kapitel[index]!];
      return { ...prev, kapitel };
    });
  }

  function kapitelHinzufuegen() {
    setEntwurf((prev) => {
      const basis = prev ?? leererEntwurf();
      return {
        ...basis,
        kapitel: [...basis.kapitel, { id: crypto.randomUUID(), titel: "", seiten: "" }],
      };
    });
  }

  async function speichern() {
    if (!entwurf) return;
    setAktionFehler(null);
    setAktionLaeuft(true);
    const input: NeuesLehrwerkInput = {
      titel: entwurf.titel,
      verlag: entwurf.verlag.trim() || null,
      jahrgangsstufe: entwurf.jahrgangsstufe.trim() ? Number(entwurf.jahrgangsstufe) : null,
      quelle: entwurf.quelle,
      kapitel: entwurf.kapitel.map((k, i) => ({
        titel: k.titel,
        seiten: k.seiten.trim() || null,
        sequence: i + 1,
      })),
    };
    const result = entwurf.bearbeitetTextbookId
      ? await aktualisiereEigenesLehrwerk(kontext.subjectId, entwurf.bearbeitetTextbookId, input)
      : await speichereNeuesLehrwerk(kontext.subjectId, input);
    setAktionLaeuft(false);
    if (!result) return setAktionFehler("Dafür fehlt die Berechtigung.");
    if (!result.ok) return setAktionFehler(result.fehler);
    setEntwurf(null);
    setFotos([]);
    setSicht("uebersicht");
  }

  // --- Übersicht -----------------------------------------------------------
  if (sicht === "uebersicht") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title={`Lehrwerk · ${kontext.subjectName}`} back={back} />
        {kontext.zugewiesen ? (
          <Block title={kontext.zugewiesen.titel} trailing={kontext.zugewiesen.verlag ?? undefined}>
            {kontext.zugewiesen.kapitel.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {kontext.zugewiesen.kapitel.map((k) => (
                  <li key={`${k.sequence}-${k.titel}`} className="text-tinte text-[0.8125rem]">
                    {k.titel}
                    {k.seiten ? <span className="text-tinte-leise"> · S. {k.seiten}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Notice>Noch keine Kapitel hinterlegt.</Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                quiet
                onClick={() => setSicht(kontext.kandidaten.length > 0 ? "kandidaten" : "foto")}
              >
                Ändern
              </Button>
              {kontext.zugewiesen.eigenes ? (
                <Button quiet onClick={bearbeiten}>
                  Bearbeiten
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => void entfernen()}
                disabled={aktionLaeuft}
                className="text-tinte-leise hover:text-offen ml-auto text-xs font-medium disabled:opacity-50"
              >
                Zuordnung entfernen
              </button>
            </div>
          </Block>
        ) : (
          <Block title="Kein Lehrwerk hinterlegt">
            <Notice>
              Ohne Lehrwerk läuft {kontext.subjectName} über eigene Themen weiter – ein Lehrwerk
              liefert nur die Kapitel-Reihenfolge und, bei Sprachen, die Vokabel-Units.
            </Notice>
            <Button onClick={() => setSicht(kontext.kandidaten.length > 0 ? "kandidaten" : "foto")}>
              Lehrwerk erfassen
            </Button>
          </Block>
        )}
        {aktionFehler ? <Notice>{aktionFehler}</Notice> : null}
      </div>
    );
  }

  // --- Vorhandenes Lehrwerk zuordnen (ohne KI) ------------------------------
  if (sicht === "kandidaten") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title={`Lehrwerk · ${kontext.subjectName}`} back={back} />
        <Block title="Vorhandenes Lehrwerk zuordnen">
          <ul className="flex flex-col gap-2">
            {kontext.kandidaten.map((k) => (
              <li
                key={k.textbookId}
                className="border-linie bg-flaeche flex items-center justify-between gap-2 rounded-[9px] border p-2.5"
              >
                <span className="min-w-0 flex-1 text-[0.8125rem]">
                  <span className="text-tinte font-medium">{k.titel}</span>
                  {k.verlag ? <span className="text-tinte-leise"> · {k.verlag}</span> : null}
                  {k.kuratiert ? (
                    <span className="text-tinte-leise text-[0.6875rem] uppercase">
                      {" "}
                      · kuratiert
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={MINI_BUTTON}
                  disabled={aktionLaeuft || k.textbookId === kontext.zugewiesen?.textbookId}
                  onClick={() => void zuordnen(k.textbookId)}
                >
                  {k.textbookId === kontext.zugewiesen?.textbookId ? "Zugeordnet" : "Zuordnen"}
                </button>
              </li>
            ))}
          </ul>
          {aktionFehler ? <Notice>{aktionFehler}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button quiet onClick={() => setSicht("foto")}>
              Neues Lehrwerk erfassen
            </Button>
            <Button quiet onClick={() => setSicht("uebersicht")}>
              Zurück
            </Button>
          </div>
        </Block>
      </div>
    );
  }

  // --- Foto ------------------------------------------------------------------
  if (sicht === "foto") {
    if (!fotoVerfuegbar) {
      return (
        <div className="flex flex-col gap-3">
          <PageHeader title={`Lehrwerk · ${kontext.subjectName}`} back={back} />
          <Notice>{NICHT_EINGERICHTET}</Notice>
        </div>
      );
    }
    const verarbeitungLaeuft = fotos.some(
      (f) => f.status === "verkleinert" || f.status === "liest",
    );
    const wartende = fotos.filter((f) => f.status === "wartet").length;
    const erfolgreich = fotos.filter((f) => f.status === "fertig").length;

    return (
      <div className="flex flex-col gap-3">
        <PageHeader title={`Lehrwerk · ${kontext.subjectName}`} back={back} />
        <Block title="Inhaltsverzeichnis abfotografieren">
          <Notice>
            Erst so viele Bilder aufnehmen oder laden, wie nötig sind (ein längeres
            Inhaltsverzeichnis kann zwei Seiten haben), dann „Einlesen&ldquo;. Die Fotos werden
            nicht gespeichert.
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
              <Button onClick={() => void fotosEinlesen()} disabled={verarbeitungLaeuft}>
                {verarbeitungLaeuft
                  ? "Liest …"
                  : `Einlesen (${wartende} ${wartende === 1 ? "Bild" : "Bilder"})`}
              </Button>
            ) : null}
          </div>
          {fotos.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {fotos.map((f) => (
                <li
                  key={f.id}
                  className="border-linie bg-flaeche flex items-center gap-3 rounded-[9px] border p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Objekt-URL aus lokaler Datei */}
                  <img
                    src={f.vorschauUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                    style={{ transform: `rotate(${f.rotation}deg)` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-tinte truncate text-[0.8125rem] font-medium">
                      {f.file.name}
                    </div>
                    <div className="text-tinte-leise text-[0.75rem]">
                      {f.status === "wartet" && "Wartet"}
                      {f.status === "verkleinert" && "Wird verkleinert …"}
                      {f.status === "liest" && "Liest das Inhaltsverzeichnis …"}
                      {f.status === "fertig" &&
                        `${f.erkannt} ${f.erkannt === 1 ? "Kapitel" : "Kapitel"} erkannt`}
                      {f.status === "fehler" && f.fehler}
                    </div>
                  </div>
                  {f.status === "wartet" || f.status === "fehler" ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => fotoDrehen(f.id)}
                        aria-label="Bild drehen"
                        className="text-tinte-leise hover:text-koenigsblau flex h-8 w-8 items-center justify-center rounded-md text-sm"
                      >
                        ↻
                      </button>
                      {f.status === "fehler" ? (
                        <button
                          type="button"
                          onClick={() => void verarbeiteFoto(f)}
                          className="text-koenigsblau px-1.5 text-[0.75rem] font-medium"
                        >
                          Nochmal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => fotoEntfernen(f.id)}
                        aria-label="Foto entfernen"
                        className="text-tinte-leise hover:text-offen flex h-8 w-8 items-center justify-center rounded-md text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {erfolgreich > 0 && !verarbeitungLaeuft ? (
            <Button onClick={weiterZurKapitelliste}>Zur Kapitelliste</Button>
          ) : null}
        </Block>
      </div>
    );
  }

  // --- Review: gemeinsame editierbare Kapitelliste --------------------------
  if (sicht === "review" && entwurf) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title={`Lehrwerk · ${kontext.subjectName}`} back={back} />
        <Block title="Angaben prüfen">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">Titel</span>
            <input
              value={entwurf.titel}
              onChange={(e) =>
                setEntwurf((prev) => (prev ? { ...prev, titel: e.target.value } : prev))
              }
              className={FIELD}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">Verlag</span>
            <input
              value={entwurf.verlag}
              onChange={(e) =>
                setEntwurf((prev) => (prev ? { ...prev, verlag: e.target.value } : prev))
              }
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium">Jahrgangsstufe</span>
            <input
              value={entwurf.jahrgangsstufe}
              onChange={(e) =>
                setEntwurf((prev) => (prev ? { ...prev, jahrgangsstufe: e.target.value } : prev))
              }
              inputMode="numeric"
              className={FIELD}
            />
          </label>
        </Block>

        <Block title="Kapitel">
          {entwurf.kapitel.length === 0 ? (
            <Notice>Noch keine Kapitel – füg welche hinzu.</Notice>
          ) : null}
          <ul className="flex flex-col gap-2">
            {entwurf.kapitel.map((k, i) => (
              <li
                key={k.id}
                className="border-linie bg-flaeche flex items-start gap-2 rounded-[9px] border p-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <input
                    value={k.titel}
                    onChange={(e) => kapitelAendern(k.id, { titel: e.target.value })}
                    placeholder="Kapiteltitel"
                    className={FIELD}
                  />
                  <input
                    value={k.seiten}
                    onChange={(e) => kapitelAendern(k.id, { seiten: e.target.value })}
                    placeholder="Seiten (optional, z. B. 48–67)"
                    className={FIELD}
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => kapitelVerschieben(k.id, -1)}
                    disabled={i === 0}
                    aria-label="Nach oben"
                    className="text-tinte-leise hover:text-koenigsblau flex h-7 w-7 items-center justify-center rounded-md text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => kapitelVerschieben(k.id, 1)}
                    disabled={i === entwurf.kapitel.length - 1}
                    aria-label="Nach unten"
                    className="text-tinte-leise hover:text-koenigsblau flex h-7 w-7 items-center justify-center rounded-md text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => kapitelEntfernen(k.id)}
                    aria-label="Kapitel entfernen"
                    className="text-tinte-leise hover:text-offen flex h-7 w-7 items-center justify-center rounded-md text-sm"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button quiet onClick={kapitelHinzufuegen}>
            Kapitel hinzufügen
          </Button>
        </Block>

        {aktionFehler ? <Notice>{aktionFehler}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void speichern()}
            disabled={aktionLaeuft || entwurf.titel.trim().length < 2}
          >
            {aktionLaeuft ? "Speichert …" : "Speichern"}
          </Button>
          <Button
            quiet
            onClick={() => {
              setEntwurf(null);
              setSicht("uebersicht");
            }}
            disabled={aktionLaeuft}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
