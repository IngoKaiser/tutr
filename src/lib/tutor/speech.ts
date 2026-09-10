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

/** Alle Stimmen einer Sprachfamilie (`de` deckt `de-DE`, `de-AT`, `de-CH`). */
export function stimmenFuerSprache(
  stimmen: readonly SpeechSynthesisVoice[],
  sprache = "de-DE",
): SpeechSynthesisVoice[] {
  const familie = sprache.split("-")[0]!.toLowerCase();
  return stimmen.filter((v) => v.lang.toLowerCase().startsWith(familie));
}

/**
 * Güte einer Systemstimme, höher ist besser (T-07b).
 *
 * `speechSynthesis` liefert auf einem Gerät oft mehrere deutsche Stimmen:
 * die alte, kompakte „Anna" (roboterhaft) neben neueren neuronalen Stimmen
 * („… (Premium)", „… (Enhanced)", Siri). Die alte Auswahl bevorzugte
 * `localService` – und traf damit auf iOS genau die kompakte. Jetzt zählt
 * zuerst die **Qualität**, `localService` nur noch als Gleichstand-Brecher
 * (der Weg soll das Gerät möglichst nicht verlassen, ADR 0011 D2).
 *
 * Die Erkennung läuft über den **Namen**, weil die Web Speech API kein
 * Qualitätsfeld hat. Das ist eine Heuristik, kein Vertrag – deshalb steht
 * die manuelle Auswahl (`use-speech.ts`) daneben.
 */
export function stimmGuete(stimme: SpeechSynthesisVoice): number {
  const name = stimme.name.toLowerCase();
  let punkte = 0;
  if (/premium|enhanced|neural|natural/.test(name)) punkte += 4;
  if (/siri/.test(name)) punkte += 3;
  // „compact" / „eloquence" sind die alten, schlechten – aktiv abwerten.
  if (/compact|eloquence/.test(name)) punkte -= 3;
  if (stimme.localService) punkte += 1;
  if (stimme.default) punkte += 0.5;
  return punkte;
}

/**
 * Die deutschen Stimmen, beste zuerst. Für die Auswahlliste im Composer.
 *
 * Sortiert zuerst nach Güte (`stimmGuete`), bei Gleichstand kommt die
 * exakt passende Region zuerst (`de-DE` vor `de-AT` für `sprache = "de-DE"`),
 * danach der Name für ein stabiles Ergebnis.
 */
export function deutscheStimmenSortiert(
  stimmen: readonly SpeechSynthesisVoice[],
  sprache = "de-DE",
): SpeechSynthesisVoice[] {
  const ziel = sprache.toLowerCase();
  const rang = (v: SpeechSynthesisVoice) =>
    stimmGuete(v) + (v.lang.toLowerCase() === ziel ? 0.25 : 0);
  return [...stimmenFuerSprache(stimmen, sprache)].sort(
    (a, b) => rang(b) - rang(a) || a.name.localeCompare(b.name, "de"),
  );
}

/**
 * Die beste verfügbare Stimme für eine Sprache (Standard Deutsch, ADR 0011
 * D2). `null`, wenn keine passt – dann nimmt der Browser seine Vorgabe.
 */
export function waehleDeutscheStimme(
  stimmen: readonly SpeechSynthesisVoice[],
  sprache = "de-DE",
): SpeechSynthesisVoice | null {
  return deutscheStimmenSortiert(stimmen, sprache)[0] ?? null;
}
