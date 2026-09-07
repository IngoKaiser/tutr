"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Zeigt an, warum eine Anmeldung fehlschlug.
 *
 * Nötig, weil Supabase den Grund ins **Hash-Fragment** schreibt
 * (`#error=access_denied&error_code=otp_expired`). Fragmente werden vom
 * Browser nie an den Server geschickt – ohne diese Komponente käme man
 * wortlos auf der Anmeldeseite heraus und wüsste nicht, was los war.
 *
 * `useSyncExternalStore` statt Effekt mit `setState`: Die Adresszeile ist
 * externer Browserzustand, und beim Rendern auf dem Server gibt es sie nicht.
 */

const MELDUNGEN: Record<string, string> = {
  otp_expired:
    "Dieser Link war nicht mehr gültig. Das passiert, wenn dein Mailprogramm ihn vorab öffnet und dabei verbraucht – fordere einfach einen neuen an.",
  access_denied: "Dieser Link war nicht mehr gültig. Fordere bitte einen neuen an.",
  "kein-code":
    "Der Link enthielt keine Anmeldeinformation. Fordere bitte einen neuen an und öffne ihn direkt aus der Mail heraus.",
  ungueltig: "Der Link konnte nicht eingelöst werden. Fordere bitte einen neuen an.",
};

/** Die Adresszeile ändert sich hier nicht mehr – kein Abonnement nötig. */
function abonniere() {
  return () => {};
}

function lieszustand() {
  return `${window.location.hash}|${window.location.search}`;
}

function aufDemServer() {
  return "|";
}

function grundAus(adresse: string): string | null {
  const [hash, query] = adresse.split("|");
  const ausHash = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  const ausQuery = new URLSearchParams(query ?? "");

  const code = ausHash.get("error_code") ?? ausHash.get("error") ?? ausQuery.get("fehler");
  if (!code) return null;

  return MELDUNGEN[code] ?? "Die Anmeldung hat nicht geklappt. Fordere bitte einen neuen Link an.";
}

export function AnmeldeFehler() {
  const adresse = useSyncExternalStore(abonniere, lieszustand, aufDemServer);
  const grund = grundAus(adresse);

  useEffect(() => {
    // Fehler aus der Adresszeile räumen, damit ein Neuladen ihn nicht wiederholt.
    if (grund) window.history.replaceState(null, "", window.location.pathname);
  }, [grund]);

  if (!grund) return null;

  return (
    <p
      role="alert"
      className="border-offen bg-offen-hell text-tinte rounded-[10px] border px-4 py-3 text-[0.8125rem] leading-normal"
    >
      {grund}
    </p>
  );
}
