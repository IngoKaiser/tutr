/**
 * Sprache im Tutor (T-02b Diktat, T-02d Vorlesen; ADR 0011).
 *
 * Alles hier läuft im Browser über die Web Speech API – **kein neuer Dienst,
 * kein Schlüssel, keine Kosten** (ADR 0011 D1/D2). Nichts geht über den
 * eigenen Server: `speechSynthesis` nutzt Systemstimmen, die Erkennung läuft
 * beim Browser-Hersteller (Chrome → Google, Safari → Apple). Genau deshalb
 * zeigt die Oberfläche vor der ersten Nutzung einen klaren Satz dazu.
 *
 * Die reinen Teile (Stimmenauswahl, Text anhängen) sind hier und
 * unit-getestet; die zustandsbehaftete Anbindung an `SpeechRecognition` /
 * `SpeechSynthesisUtterance` liegt in `use-speech.ts`.
 */

// --- Minimaltypen für SpeechRecognition -------------------------------
// TypeScript liefert `SpeechSynthesis*` mit, aber **nicht** die
// Erkennungsseite (`SpeechRecognition`, `webkitSpeechRecognition`). Nur was
// wir wirklich anfassen, hier lokal deklariert – kein `declare global`.

export interface SpeechRecognitionErgebnis {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { readonly transcript: string };
  readonly [index: number]: { readonly transcript: string };
}

export interface SpeechRecognitionErgebnisEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionErgebnis;
    readonly [index: number]: SpeechRecognitionErgebnis;
  };
}

export interface SpeechRecognitionAehnlich {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionErgebnisEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionKonstruktor = new () => SpeechRecognitionAehnlich;

interface FensterMitSprache {
  SpeechRecognition?: SpeechRecognitionKonstruktor;
  webkitSpeechRecognition?: SpeechRecognitionKonstruktor;
}

/** Die Konstruktorfunktion des Browsers, oder `null`. Standard- vor `webkit`-Variante. */
export function spracherkennungKonstruktor(): SpeechRecognitionKonstruktor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as FensterMitSprache;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Kann der Browser gesprochene Eingabe erkennen? */
export function diktatVerfuegbar(): boolean {
  return spracherkennungKonstruktor() !== null;
}

/** Kann der Browser Text vorlesen? */
export function vorleseVerfuegbar(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// --- reine Helfer ----------------------------------------------------

/**
 * Hängt erkannten Text an das an, was schon im Feld steht. Trennt mit genau
 * einem Leerzeichen, wenn nötig – die Erkennung liefert oft ohne führendes
 * Leerzeichen, und zwei Diktat-Häppchen sollen nicht zusammenkleben.
 */
export function diktatAnhaengen(bisher: string, neu: string): string {
  const rechts = neu.trim();
  if (!rechts) return bisher;
  if (!bisher) return rechts;
  return /\s$/.test(bisher) ? bisher + rechts : `${bisher} ${rechts}`;
}

/**
 * Wählt die beste Stimme für eine Sprache (Standard Deutsch, ADR 0011 D2).
 *
 * Vorrang für **lokale** Stimmen (`localService`): Manche Systemstimmen sind
 * netzgebunden, und der Sinn dieses Wegs ist ja, dass nichts nach außen
 * geht. Reihenfolge: exakte Sprache + lokal → exakte Sprache → Sprachfamilie
 * (`de` deckt `de-DE`, `de-AT`) + lokal → Sprachfamilie → nichts (dann nimmt
 * der Browser seine Vorgabe).
 */
export function waehleDeutscheStimme(
  stimmen: readonly SpeechSynthesisVoice[],
  sprache = "de-DE",
): SpeechSynthesisVoice | null {
  if (stimmen.length === 0) return null;
  const familie = sprache.split("-")[0]!.toLowerCase();
  const passtGenau = (v: SpeechSynthesisVoice) => v.lang.toLowerCase() === sprache.toLowerCase();
  const passtFamilie = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith(familie);

  return (
    stimmen.find((v) => passtGenau(v) && v.localService) ??
    stimmen.find(passtGenau) ??
    stimmen.find((v) => passtFamilie(v) && v.localService) ??
    stimmen.find(passtFamilie) ??
    null
  );
}
