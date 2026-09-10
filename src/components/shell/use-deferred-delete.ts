"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Löschen mit Rückgängig-Fenster (V-11).
 *
 * Statt eines Rückfrage-Dialogs verschwindet die Zeile sofort – der
 * Serveraufruf startet erst nach `verzoegerungMs` (Vorgabe 5 s). Bis dahin
 * holt „Rückgängig" sie zurück. Wer die Seite vorher verlässt, dessen offene
 * Löschungen werden **ausgeführt**, nicht verworfen: Ein halb gelöschter
 * Zustand wäre schlimmer als ein zu früh bestätigter.
 *
 * Rein clientseitig; die eigentliche Löschung ist die übergebene Server
 * Action. Der Aufrufer filtert die noch schwebenden Einträge selbst aus
 * seiner Liste (`istEntfernt`) und zeigt die Rückgängig-Leiste zu `pending`.
 */
export function useDeferredDelete<T extends { id: string }>(
  loeschen: (id: string) => Promise<void> | void,
  verzoegerungMs = 5000,
) {
  const [pending, setPending] = useState<T[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // `loeschen` kommt bei jedem Render neu (meist eine Inline-Funktion); über
  // eine Ref bleiben die Callbacks unten stabil und zeigen trotzdem auf die
  // aktuelle Fassung. Die Ref wird im Effekt gesetzt, nicht im Render
  // (react-hooks/refs).
  const loeschenRef = useRef(loeschen);
  useEffect(() => {
    loeschenRef.current = loeschen;
  });

  const ausfuehren = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setPending((p) => p.filter((e) => e.id !== id));
    void loeschenRef.current(id);
  }, []);

  const entfernen = useCallback(
    (eintrag: T) => {
      const alt = timers.current.get(eintrag.id);
      if (alt) clearTimeout(alt);
      setPending((p) => (p.some((e) => e.id === eintrag.id) ? p : [...p, eintrag]));
      timers.current.set(
        eintrag.id,
        setTimeout(() => ausfuehren(eintrag.id), verzoegerungMs),
      );
    },
    [ausfuehren, verzoegerungMs],
  );

  const zuruecknehmen = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setPending((p) => p.filter((e) => e.id !== id));
  }, []);

  // Beim Unmount alle offenen Löschungen sofort ausführen – nicht verwerfen.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        void loeschenRef.current(id);
      }
      map.clear();
    };
  }, []);

  const istEntfernt = useCallback((id: string) => pending.some((e) => e.id === id), [pending]);

  return { pending, entfernen, zuruecknehmen, istEntfernt };
}
