"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  diktatAnhaengen,
  diktatVerfuegbar,
  spracherkennungKonstruktor,
  vorleseVerfuegbar,
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

/**
 * Etwas langsamer als die Vorgabe (T-07b). Die kompakten Systemstimmen sind
 * bei normalem Tempo schwer zu folgen; 0,92 ist spürbar ruhiger, ohne
 * gedehnt zu klingen.
 */
const VORLESE_TEMPO = 0.92;

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
  const [pausiert, setPausiert] = useState(false);

  useEffect(() => {
    if (!vorleseVerfuegbar()) return;
    return () => window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => {
    if (!vorleseVerfuegbar()) return;
    window.speechSynthesis.cancel();
    setSprichtId(null);
    setPausiert(false);
  }, []);

  const liesVor = useCallback((id: string, text: string) => {
    if (!vorleseVerfuegbar() || !text.trim()) return;
    window.speechSynthesis.cancel();

    const rede = new SpeechSynthesisUtterance(text);
    rede.lang = "de-DE";
    rede.rate = VORLESE_TEMPO;

    /**
     * **`utterance.voice` bleibt unangetastet** (T-10, aufgeräumt in V-13).
     *
     * Früher wählte hier eine eigene Heuristik aus `getVoices()` – und
     * überschrieb damit, was in den iOS-Einstellungen als Stimme steht
     * („Anna (Premium)" gewählt, trotzdem die kompakte Anna gehört). Ohne
     * eigene Wahl nimmt das Betriebssystem seine dort eingestellte Stimme.
     * Eine eigene Auswahl direkt im Chat (V-12) blieb dünn – kaum
     * unterscheidbare Browser-Stimmen auf iOS – und ist wieder raus; eine
     * echte Stimmenauswahl gehört, wenn überhaupt, nach „Einstellungen"
     * und wartet auf die Cloud-TTS-Entscheidung (ADR 0013).
     */
    rede.onend = () => {
      setSprichtId((jetzt) => (jetzt === id ? null : jetzt));
      setPausiert(false);
    };
    rede.onerror = () => {
      setSprichtId((jetzt) => (jetzt === id ? null : jetzt));
      setPausiert(false);
    };

    setSprichtId(id);
    setPausiert(false);
    window.speechSynthesis.speak(rede);

    /**
     * Notbremse gegen den hängenden „läuft gerade"-Zustand (T-10): iOS
     * verwirft `speak()` ohne vorausgegangene Nutzergeste stillschweigend
     * – dann feuert weder `onend` noch `onerror`, und der Knopf stünde
     * für immer auf Pause. Kurz nachsehen, ob wirklich etwas läuft.
     */
    window.setTimeout(() => {
      const laeuft = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      if (!laeuft) setSprichtId((jetzt) => (jetzt === id ? null : jetzt));
    }, 500);
  }, []);

  /** Anhalten, ohne die Stelle zu verlieren (T-10). */
  const pause = useCallback(() => {
    if (!vorleseVerfuegbar()) return;
    window.speechSynthesis.pause();
    setPausiert(true);
  }, []);

  /** Weiter, wo angehalten wurde. */
  const weiter = useCallback(() => {
    if (!vorleseVerfuegbar()) return;
    window.speechSynthesis.resume();
    setPausiert(false);
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
    /** Läuft gerade, ist aber angehalten (T-10). */
    pausiert,
    liesVor,
    pause,
    weiter,
    stop,
    umschaltenImmer,
  };
}
