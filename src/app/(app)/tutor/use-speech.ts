"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  deutscheStimmenSortiert,
  diktatAnhaengen,
  diktatVerfuegbar,
  spracherkennungKonstruktor,
  vorleseVerfuegbar,
  waehleDeutscheStimme,
  type SpeechRecognitionAehnlich,
} from "@/lib/tutor/speech";

/**
 * React-Anbindung an die Web Speech API (T-02b, T-02d; ADR 0011).
 *
 * Zwei Haken, beide rein clientseitig, beide ohne Wirkung, wenn der Browser
 * nicht mitspielt (`verfuegbar` ist dann `false` und die Oberfläche zeigt
 * den Knopf gar nicht erst).
 */

const VORLESEN_KEY = "tutr:vorlesen";
const STIMME_KEY = "tutr:vorlesen-stimme";

/**
 * Etwas langsamer als die Vorgabe (T-07b). Die kompakten Systemstimmen sind
 * bei normalem Tempo schwer zu folgen; 0,92 ist spürbar ruhiger, ohne
 * gedehnt zu klingen.
 */
const VORLESE_TEMPO = 0.92;

/**
 * `speechSynthesis.getVoices()` gibt bei jedem Aufruf ein neues Array – für
 * `useSyncExternalStore` wäre das eine Endlosschleife. Deshalb ein
 * Modul-Cache, der nur ersetzt wird, wenn sich die Stimmenliste wirklich
 * ändert (iOS lädt sie asynchron nach).
 */
let stimmenCache: readonly SpeechSynthesisVoice[] = [];
function stimmenSnapshot(): readonly SpeechSynthesisVoice[] {
  if (!vorleseVerfuegbar()) return stimmenCache;
  const aktuell = window.speechSynthesis.getVoices();
  const gleich =
    aktuell.length === stimmenCache.length &&
    aktuell.every((v, i) => v.voiceURI === stimmenCache[i]?.voiceURI);
  if (!gleich) stimmenCache = aktuell;
  return stimmenCache;
}

/** Fähigkeit, die es auf dem Server nicht gibt – über `useSyncExternalStore`, damit die Hydration sauber bleibt. */
function useBrowserFaehigkeit(pruefe: () => boolean): boolean {
  return useSyncExternalStore(
    () => () => {},
    pruefe,
    () => false,
  );
}

// --- Diktat (T-02b) --------------------------------------------------

/**
 * Gesprochenes landet als Text – **nicht** direkt im Chat, sondern im Feld,
 * wo das Kind es liest und korrigiert (ADR 0011 D1). `onText` bekommt bei
 * jedem Zwischenstand den vollen Feldwert (Basis + bisher Gesprochenes),
 * damit die Eingabe live mitläuft.
 */
export function useDiktat({
  sprache = "de-DE",
  onText,
}: {
  sprache?: string;
  onText: (wert: string) => void;
}) {
  const verfuegbar = useBrowserFaehigkeit(diktatVerfuegbar);
  const [hoert, setHoert] = useState(false);
  const erkennungRef = useRef<SpeechRecognitionAehnlich | null>(null);
  const basisRef = useRef("");

  useEffect(() => () => erkennungRef.current?.abort(), []);

  const stoppen = useCallback(() => {
    erkennungRef.current?.stop();
  }, []);

  const starten = useCallback(
    (basis: string) => {
      const Konstruktor = spracherkennungKonstruktor();
      if (!Konstruktor) return;

      const erkennung = new Konstruktor();
      erkennung.lang = sprache;
      erkennung.continuous = false;
      erkennung.interimResults = true;
      basisRef.current = basis;

      erkennung.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i]!.item(0).transcript;
        }
        onText(diktatAnhaengen(basisRef.current, text));
      };
      erkennung.onerror = () => setHoert(false);
      erkennung.onend = () => {
        setHoert(false);
        erkennungRef.current = null;
      };

      erkennungRef.current = erkennung;
      erkennung.start();
      setHoert(true);
    },
    [sprache, onText],
  );

  const umschalten = useCallback(
    (basis: string) => {
      if (hoert) stoppen();
      else starten(basis);
    },
    [hoert, starten, stoppen],
  );

  return { verfuegbar, hoert, umschalten, stoppen };
}

// --- Vorlesen (T-02d) ----------------------------------------------

/** localStorage-Wert lesen, gefahrlos (privater Modus kann werfen). */
function lesePref(): boolean {
  try {
    return window.localStorage.getItem(VORLESEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Die vom Kind gewählte Stimme (`voiceURI`), oder `""` für „beste automatisch". */
function leseStimmePref(): string {
  try {
    return window.localStorage.getItem(STIMME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Damit ein Umschalten in einer Komponente auch die andere im selben Tab erreicht. */
const prefHoerer = new Set<() => void>();

/**
 * Liest Tutor-Antworten über `speechSynthesis` vor – Systemstimme, kostenlos
 * (ADR 0011 D2). Standardmäßig **aus**; wer es einschaltet, behält es
 * (localStorage). Tippen oder ein neuer Aufruf stoppt das Laufende.
 */
export function useVorlesen() {
  const verfuegbar = useBrowserFaehigkeit(vorleseVerfuegbar);
  const immerAn = useSyncExternalStore(
    (onChange) => {
      prefHoerer.add(onChange);
      if (typeof window !== "undefined") window.addEventListener("storage", onChange);
      return () => {
        prefHoerer.delete(onChange);
        if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
      };
    },
    lesePref,
    () => false,
  );
  const [sprichtId, setSprichtId] = useState<string | null>(null);

  // Die Stimmenliste (iOS lädt sie asynchron) und die gewählte Stimme, beide
  // über `useSyncExternalStore` – kein `setState` im Effekt.
  const stimmen = useSyncExternalStore(
    (onChange) => {
      if (!vorleseVerfuegbar()) return () => {};
      window.speechSynthesis.addEventListener("voiceschanged", onChange);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
    },
    stimmenSnapshot,
    () => stimmenCache,
  );
  const stimmeUri = useSyncExternalStore(
    (onChange) => {
      prefHoerer.add(onChange);
      if (typeof window !== "undefined") window.addEventListener("storage", onChange);
      return () => {
        prefHoerer.delete(onChange);
        if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
      };
    },
    leseStimmePref,
    () => "",
  );

  const deutscheStimmen = deutscheStimmenSortiert(stimmen);

  useEffect(() => {
    if (!vorleseVerfuegbar()) return;
    return () => window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => {
    if (!vorleseVerfuegbar()) return;
    window.speechSynthesis.cancel();
    setSprichtId(null);
  }, []);

  const liesVor = useCallback(
    (id: string, text: string) => {
      if (!vorleseVerfuegbar() || !text.trim()) return;
      window.speechSynthesis.cancel();

      const rede = new SpeechSynthesisUtterance(text);
      rede.lang = "de-DE";
      rede.rate = VORLESE_TEMPO;
      const gewaehlt = stimmeUri
        ? deutscheStimmen.find((v) => v.voiceURI === stimmeUri)
        : undefined;
      const stimme = gewaehlt ?? waehleDeutscheStimme(deutscheStimmen);
      if (stimme) rede.voice = stimme;
      rede.onend = () => setSprichtId((jetzt) => (jetzt === id ? null : jetzt));
      rede.onerror = () => setSprichtId((jetzt) => (jetzt === id ? null : jetzt));

      setSprichtId(id);
      window.speechSynthesis.speak(rede);
    },
    [deutscheStimmen, stimmeUri],
  );

  const stimmeWaehlen = useCallback((uri: string) => {
    try {
      if (uri) window.localStorage.setItem(STIMME_KEY, uri);
      else window.localStorage.removeItem(STIMME_KEY);
    } catch {
      // egal – dann merkt es sich der Browser nicht
    }
    for (const hoerer of prefHoerer) hoerer();
  }, []);

  const umschaltenImmer = useCallback(() => {
    const neu = !lesePref();
    try {
      window.localStorage.setItem(VORLESEN_KEY, neu ? "1" : "0");
    } catch {
      // Dann merkt es sich der Browser eben nicht.
    }
    if (!neu && vorleseVerfuegbar()) window.speechSynthesis.cancel();
    for (const hoerer of prefHoerer) hoerer();
  }, []);

  return {
    verfuegbar,
    immerAn,
    sprichtId,
    liesVor,
    stop,
    umschaltenImmer,
    /** Deutsche Stimmen, beste zuerst. Leer, bis der Browser sie geladen hat. */
    stimmen: deutscheStimmen,
    /** `voiceURI` der gewählten Stimme, `""` = automatisch die beste. */
    stimmeUri,
    stimmeWaehlen,
  };
}
