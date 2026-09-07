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

const MESSAGES: Record<string, string> = {
  otp_expired:
    "Dieser Link war nicht mehr gültig. Das passiert, wenn dein Mailprogramm ihn vorab öffnet und dabei verbraucht – fordere einfach einen neuen an.",
  access_denied: "Dieser Link war nicht mehr gültig. Fordere bitte einen neuen an.",
  "kein-code":
    "Der Link enthielt keine Anmeldeinformation. Fordere bitte einen neuen an und öffne ihn direkt aus der Mail heraus.",
  ungueltig: "Der Link konnte nicht eingelöst werden. Fordere bitte einen neuen an.",
};

/** Die Adresszeile ändert sich hier nicht mehr – kein Abonnement nötig. */
function subscribe() {
  return () => {};
}

function readLocation() {
  return `${window.location.hash}|${window.location.search}`;
}

function onServer() {
  return "|";
}

function reasonFrom(location: string): string | null {
  const [hash, query] = location.split("|");
  const fromHash = new URLSearchParams((hash ?? "").replace(/^#/, ""));
  const fromQuery = new URLSearchParams(query ?? "");

  // `fehler` bleibt deutsch: der Parameter ist Teil der sichtbaren URL.
  const code = fromHash.get("error_code") ?? fromHash.get("error") ?? fromQuery.get("fehler");
  if (!code) return null;

  return MESSAGES[code] ?? "Die Anmeldung hat nicht geklappt. Fordere bitte einen neuen Link an.";
}

export function LoginError() {
  const location = useSyncExternalStore(subscribe, readLocation, onServer);
  const reason = reasonFrom(location);

  useEffect(() => {
    // Fehler aus der Adresszeile räumen, damit ein Neuladen ihn nicht wiederholt.
    if (reason) window.history.replaceState(null, "", window.location.pathname);
  }, [reason]);

  if (!reason) return null;

  return (
    <p
      role="alert"
      className="border-offen bg-offen-hell text-tinte rounded-[10px] border px-4 py-3 text-[0.8125rem] leading-normal"
    >
      {reason}
    </p>
  );
}
