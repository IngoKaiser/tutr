"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  AufgabenblattIcon,
  BildIcon,
  KameraIcon,
  LautsprecherAusIcon,
  LautsprecherIcon,
  MikrofonIcon,
  PfeilRunterIcon,
  PlusIcon,
  SendenIcon,
  StoppIcon,
} from "@/components/shell/icons";
import { Block, Notice } from "@/components/shell/primitives";
import { anzeigeFenster, FENSTER_LABEL, type Auslastung } from "@/lib/ai/rate-limit";
import { prepareImageForUpload, type PreparedImage } from "@/lib/image";

import { useDiktat, type VorlesenSteuerung } from "./use-speech";

/**
 * Das Eingabefeld aller Tutor-Dialoge (T-12).
 *
 * **Eine Komponente für beide Wege** – freier Chat und Hausaufgaben-Dialog
 * hatten bis hierher je ein eigenes Feld mit eigener Tastenreihe. Zwei
 * Felder, die dasselbe tun, laufen auseinander: Das Foto gab es nur im
 * Hausaufgaben-Dialog, Diktat und Vorlesen nur im freien Chat. Jetzt kann
 * überall dasselbe, und eine Änderung wirkt an beiden Stellen.
 *
 * **Aufbau (Vorbild ChatGPT/Claude):** Der Text liegt oben und nimmt die
 * volle Breite; die Knöpfe stehen in einer Zeile **darunter**. Vorher saßen
 * sie rechts *neben* dem Text und drängten ihn auf gut die halbe Breite –
 * beim Diktieren wuchs das Feld dadurch über den halben Bildschirm.
 *
 * **Höhe:** startet einzeilig, wächst bis drei Zeilen, danach scrollt der
 * Text im Feld. Die Höhe kommt weiter aus dem unsichtbaren Zwilling (CSS
 * Grid, kein `scrollHeight`-Messen, wie seit V-13), nur der Deckel ist von
 * `max-h-40` auf drei Zeilen gesunken.
 *
 * **Anhänge:** über das Plus-Menü links, wie man es von ChatGPT und Claude
 * kennt – Kamera und Mediathek getrennt, weil `capture="environment"` am
 * Handy direkt die Kamera öffnet und ohne das Attribut die Mediathek. Am
 * Rechner tut `capture` nichts, dann führen beide zur Dateiauswahl.
 *
 * **Pegel:** rechts in der Tastenreihe, ohne Prozentzahl und ohne
 * Farbwechsel – er sagt „so voll ist der Tag", nicht „Achtung". Details in
 * `lib/ai/rate-limit.ts` (S-03e).
 */

/** Einmaliger Hinweis vor der ersten Diktat-Nutzung (ADR 0011 D1). */
const DIKTAT_HINWEIS_KEY = "tutr:diktat-hinweis";
const DIKTAT_HINWEIS =
  "Zum Diktieren schickt dein Browser die Aufnahme an seinen Hersteller (bei Chrome an Google, bei Safari an Apple) und gibt den Text zurück. Nichts davon läuft über tutr, und die Aufnahme wird nirgends gespeichert.";

const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

export type ComposerAnhang = { vorschauUrl: string; datei: PreparedImage };

export function Composer({
  wert,
  onChange,
  onSend,
  pending,
  platzhalter,
  sprache = "de-DE",
  vorlesen,
  auslastung,
  amEnde,
  nachUnten,
  anhang,
  onAnhang,
  hausaufgabeHref,
  kinder,
}: {
  wert: string;
  onChange: (v: string) => void;
  /** Bekommt den Anhang mit – der Aufrufer schickt beides zusammen und räumt danach über `onAnhang(null)` auf. */
  onSend: () => void;
  pending: boolean;
  platzhalter: string;
  sprache?: string;
  /** Vorlesen ist optional: Der Hausaufgaben-Dialog hat es (noch) nicht. */
  vorlesen?: VorlesenSteuerung;
  /** `null`, solange der Stand nicht geladen ist – dann bleibt der Pegel weg statt 0 % zu behaupten. */
  auslastung: Auslastung | null;
  /** Für den Sprung ans Ende, wenn der Blick nicht am Ende klebt. */
  amEnde?: boolean;
  nachUnten?: () => void;
  anhang: ComposerAnhang | null;
  onAnhang: (a: ComposerAnhang | null) => void;
  /**
   * Wohin „Hausaufgabe fotografieren" im Plus-Menü führt (T-16). Ungesetzt
   * im Hausaufgaben-Dialog selbst – dort ist man schon drin.
   */
  hausaufgabeHref?: string;
  /** Zusätzliche Bedienelemente über der Tastenreihe – z. B. der Bahn-Umschalter der Hausaufgabe. */
  kinder?: React.ReactNode;
}) {
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [menueOffen, setMenueOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const kameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const feldRef = useRef<HTMLTextAreaElement>(null);
  const menueRef = useRef<HTMLDivElement>(null);
  const diktat = useDiktat({ sprache, onText: onChange });

  /**
   * Mitlaufen lassen, was gerade entsteht (T-16).
   *
   * Beim Tippen hält der Browser den Cursor von selbst im Bild – aber nur,
   * solange er am Ende steht. Beim **Diktieren** kommt der Text von außen
   * (`useDiktat` ruft `onChange`), da rührt sich der Cursor nicht, und das
   * Feld blieb oben stehen, während unten weitergeschrieben wurde. Deshalb
   * hier von Hand ans Ende – aber nur, wenn der Cursor auch am Ende ist:
   * Wer mitten im Text etwas korrigiert, soll nicht weggescrollt werden.
   */
  useEffect(() => {
    const feld = feldRef.current;
    if (!feld) return;
    if (feld.selectionStart === feld.value.length) feld.scrollTop = feld.scrollHeight;
  }, [wert]);

  // Klick daneben schließt das Menü – sonst bliebe es offen, während man
  // schon wieder tippt, und verdeckte die Tastenreihe.
  useEffect(() => {
    if (!menueOffen) return;
    const zu = (e: MouseEvent) => {
      if (!menueRef.current?.contains(e.target as Node)) setMenueOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [menueOffen]);

  async function fotoAusgewaehlt(file: File) {
    setFehler(null);
    try {
      const datei = await prepareImageForUpload(file);
      onAnhang({ vorschauUrl: URL.createObjectURL(file), datei });
    } catch {
      setFehler("Das Foto ließ sich nicht lesen. Versuch es noch einmal.");
    }
  }

  function mikrofon() {
    if (diktat.hoert) {
      diktat.umschalten(wert);
      return;
    }
    let bestaetigt = false;
    try {
      bestaetigt = window.localStorage.getItem(DIKTAT_HINWEIS_KEY) === "1";
    } catch {
      // localStorage nicht verfügbar – dann den Hinweis lieber jedes Mal zeigen.
    }
    if (!bestaetigt) {
      setHinweisOffen(true);
      return;
    }
    vorlesen?.stop();
    diktat.umschalten(wert);
  }

  function hinweisWeg() {
    try {
      window.localStorage.setItem(DIKTAT_HINWEIS_KEY, "1");
    } catch {
      // egal
    }
    setHinweisOffen(false);
    vorlesen?.stop();
    diktat.umschalten(wert);
  }

  const absendbar = (wert.trim().length > 0 || anhang !== null) && !pending;

  return (
    // **Kein `sticky`** (T-12a): Der Composer liegt als festes Geschwister
    // neben dem Scrollbereich, nicht darin. Vorher klebte er per
    // `sticky bottom-0` im scrollenden `main` – auf dem iPhone rutschte er
    // beim Scrollen mit nach oben und ließ eine leere Fläche darunter
    // stehen. `shrink-0`, damit ihn ein langer Verlauf nicht zusammendrückt;
    // `-mx-4 px-4` lässt den Hintergrund bis an den Rand laufen, `-mb-5`
    // frisst das `py-5` der Hülle.
    <div className="bg-papier border-linie relative -mx-4 -mb-5 flex shrink-0 flex-col gap-2 border-t px-4 pt-2 pb-3">
      {nachUnten && amEnde === false ? (
        <button
          type="button"
          onClick={nachUnten}
          aria-label="Zum Ende springen"
          className="border-linie-stark bg-flaeche text-tinte-weich hover:bg-papier-tief hover:text-tinte absolute -top-11 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors"
        >
          <PfeilRunterIcon size={17} />
        </button>
      ) : null}

      {hinweisOffen ? (
        <Block>
          <Notice>{DIKTAT_HINWEIS}</Notice>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={hinweisWeg}
              className="bg-koenigsblau text-auf-koenigsblau rounded-[9px] px-4 py-2 text-sm font-semibold"
            >
              Verstanden, los
            </button>
            <button
              type="button"
              onClick={() => setHinweisOffen(false)}
              className="border-linie-stark bg-flaeche text-tinte rounded-[9px] border px-4 py-2 text-sm font-semibold"
            >
              Doch tippen
            </button>
          </div>
        </Block>
      ) : null}

      {fehler ? <Notice>{fehler}</Notice> : null}
      {diktat.hoert ? (
        <span className="text-koenigsblau text-[0.6875rem] font-medium">tutr hört zu …</span>
      ) : null}

      {kinder}

      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void fotoAusgewaehlt(file);
        }}
      />
      <input
        ref={galerieRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void fotoAusgewaehlt(file);
        }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="border-linie-stark bg-flaeche focus-within:outline-koenigsblau flex flex-col gap-1.5 rounded-[12px] border p-1.5 focus-within:outline-2 focus-within:outline-offset-1"
      >
        {anhang ? (
          <div className="border-linie bg-papier flex items-center gap-2 rounded-[9px] border p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- Objekt-URL aus lokaler Datei */}
            <img src={anhang.vorschauUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-tinte-leise flex-1 text-[0.75rem]">Foto angehängt</span>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(anhang.vorschauUrl);
                onAnhang(null);
              }}
              aria-label="Foto entfernen"
              className="text-tinte-leise hover:text-offen px-2 text-sm"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/*
         * Der Text nimmt die volle Breite – die Knöpfe stehen darunter.
         * Die Höhe kommt aus dem unsichtbaren Zwilling in derselben
         * Grid-Zelle (V-13): Er trägt denselben Text mit derselben Schrift
         * und hat eine natürliche Höhe, das Feld übernimmt sie.
         *
         * **Gescrollt wird im Feld selbst, nicht in der Hülle** (T-16).
         * Vorher war es umgekehrt: Das Feld stand `overflow-hidden` in
         * voller Texthöhe, die Hülle darum scrollte. Das brach an drei
         * Stellen, alle beim Diktieren am Gerät aufgefallen – ein Feld ohne
         * eigenen Scrollbereich hält beim Tippen den Cursor nicht im Bild
         * (der Browser tut das nur für scrollende Elemente), der Finger fand
         * im Text nichts zum Schieben, und die Hülle blieb zwischen zwei
         * Zeilen stehen. Jetzt deckelt der **Zwilling** die Grid-Zeile auf
         * drei Zeilen, das Feld erbt diese Höhe und scrollt darin selbst.
         *
         * `leading-6` statt `leading-relaxed`: 24 px sind ein glatter
         * Zeilenschritt, 3 × 24 + 12 px Polster = genau die 5,25 rem des
         * Deckels. `leading-relaxed` ergab 22,75 px – nie ein ganzes
         * Vielfaches, weshalb beim Scrollen unten immer eine halbe Zeile
         * stehenblieb (im Screenshot vom Gerät gut zu sehen).
         */}
        <div className="grid min-h-9 w-full px-1.5 text-sm">
          <div
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 max-h-[5.25rem] overflow-hidden py-1.5 leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {wert ? `${wert} ` : " "}
          </div>
          <textarea
            ref={feldRef}
            value={wert}
            onChange={(e) => {
              vorlesen?.stop();
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={platzhalter}
            className="text-tinte placeholder:text-tinte-leise col-start-1 row-start-1 w-full resize-none overflow-y-auto bg-transparent py-1.5 leading-6 outline-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <div ref={menueRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenueOffen((o) => !o)}
              aria-label="Anhang hinzufügen"
              aria-expanded={menueOffen}
              className={`${ICON_BUTTON} ${
                menueOffen
                  ? "bg-koenigsblau-hell text-koenigsblau"
                  : "text-tinte-leise hover:bg-papier-tief"
              }`}
            >
              <PlusIcon />
            </button>
            {menueOffen ? (
              <div className="border-linie-stark bg-flaeche absolute bottom-11 left-0 z-20 flex w-56 flex-col overflow-hidden rounded-[10px] border shadow-lg">
                {/* Der Hausaufgaben-Weg steht **oben** (§5: „‚Hausaufgabe' ist
                    der prominenteste Chip") und ist von den zwei Foto-Wegen
                    darunter abgesetzt: Er hängt kein Bild an diese Nachricht,
                    er startet den Ablauf aus §4a mit eigener Aufgabenliste.
                    Im Hausaufgaben-Dialog selbst fehlt er – dort ist man
                    schon drin (`hausaufgabeHref` bleibt dort ungesetzt). */}
                {hausaufgabeHref ? (
                  <Link
                    href={hausaufgabeHref}
                    onClick={() => setMenueOffen(false)}
                    className="text-tinte hover:bg-papier-tief border-linie flex items-center gap-2.5 border-b px-3 py-2.5 text-left text-[0.8125rem] font-medium"
                  >
                    <AufgabenblattIcon size={17} />
                    Hausaufgabe fotografieren
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMenueOffen(false);
                    kameraRef.current?.click();
                  }}
                  className="text-tinte hover:bg-papier-tief flex items-center gap-2.5 px-3 py-2.5 text-left text-[0.8125rem]"
                >
                  <KameraIcon size={17} />
                  Foto aufnehmen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenueOffen(false);
                    galerieRef.current?.click();
                  }}
                  className="text-tinte hover:bg-papier-tief border-linie flex items-center gap-2.5 border-t px-3 py-2.5 text-left text-[0.8125rem]"
                >
                  <BildIcon size={17} />
                  Foto auswählen
                </button>
              </div>
            ) : null}
          </div>

          {vorlesen?.verfuegbar ? (
            <button
              type="button"
              onClick={vorlesen.umschaltenImmer}
              aria-pressed={vorlesen.immerAn}
              aria-label={vorlesen.immerAn ? "Antworten vorlesen: an" : "Antworten vorlesen: aus"}
              className={`${ICON_BUTTON} ${
                vorlesen.immerAn
                  ? "bg-koenigsblau-hell text-koenigsblau"
                  : "text-tinte-leise hover:bg-papier-tief"
              }`}
            >
              {vorlesen.immerAn ? <LautsprecherIcon /> : <LautsprecherAusIcon />}
            </button>
          ) : null}

          {diktat.verfuegbar ? (
            <button
              type="button"
              onClick={mikrofon}
              aria-pressed={diktat.hoert}
              aria-label={diktat.hoert ? "Diktat beenden" : "Diktieren"}
              className={`${ICON_BUTTON} ${
                diktat.hoert
                  ? "bg-koenigsblau text-auf-koenigsblau"
                  : "text-tinte-leise hover:bg-papier-tief"
              }`}
            >
              {diktat.hoert ? <StoppIcon size={16} /> : <MikrofonIcon />}
            </button>
          ) : null}

          <div className="flex-1" />

          {auslastung ? <Pegel auslastung={auslastung} /> : null}

          <button
            type="submit"
            disabled={!absendbar}
            aria-label={pending ? "Der Tutor schreibt" : "Senden"}
            className={`${ICON_BUTTON} ${
              absendbar
                ? "bg-koenigsblau text-auf-koenigsblau"
                : "bg-papier-tief text-tinte-leise cursor-default"
            }`}
          >
            <SendenIcon className={pending ? "animate-pulse" : undefined} />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Der Pegel in der Tastenreihe (S-03e): das straffere der beiden sichtbaren
 * Fenster, ohne Prozentzahl und ohne Farbwechsel.
 *
 * Die Zahl steht nur im `aria-label` – auf dem Feld, in dem man gerade
 * schreibt, wäre „73 %" eine zweite Sache, die um Aufmerksamkeit bittet.
 * Der Balken beantwortet dieselbe Frage im Vorbeisehen.
 */
function Pegel({ auslastung }: { auslastung: Auslastung }) {
  const { fenster, anteil } = anzeigeFenster(auslastung);
  const prozent = Math.round(anteil * 100);

  return (
    <span
      role="img"
      aria-label={`${FENSTER_LABEL[fenster]}: ${prozent} % genutzt`}
      title={`${FENSTER_LABEL[fenster]}: ${prozent} % genutzt`}
      className="mr-1 flex shrink-0 flex-col justify-center gap-0.5"
    >
      <span className="text-tinte-leise text-[0.5625rem] leading-none">
        {FENSTER_LABEL[fenster]}
      </span>
      <span className="bg-papier-tief block h-1 w-10 overflow-hidden rounded-full">
        <span
          className="bg-koenigsblau block h-full rounded-full"
          style={{ width: `${prozent}%` }}
        />
      </span>
    </span>
  );
}
