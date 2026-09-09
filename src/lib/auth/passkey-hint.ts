/**
 * Merkt sich, dass auf **diesem Browser** schon einmal ein Passkey für tutr
 * benutzt wurde (F-14).
 *
 * Der Anlass: Ruft `navigator.credentials.get()` auf einem Gerät ohne
 * passenden Passkey auf, zeigt das Betriebssystem seinen eigenen Dialog —
 * „QR-Code scannen", „Sicherheitsschlüssel verwenden". Für ein Kind, das
 * schlicht noch kein Profil hat, ist das eine Sackgasse aus lauter Wegen,
 * die es nicht gehen kann.
 *
 * **Fragen kann man das Gerät nicht.** WebAuthn verrät absichtlich nie, ob
 * für eine Seite ein Passkey existiert — sonst könnte jede Website das
 * Vorhandensein eines Kontos abfragen. Deshalb diese Notiz statt einer
 * Abfrage: ein einzelnes Ja/Nein im Browser, gesetzt nach erfolgreicher
 * Registrierung oder Anmeldung.
 *
 * Sie ist ein **Hinweis, kein Wahrheitsbeweis**: Wer seine Browserdaten
 * löscht, verliert sie, obwohl der Passkey im Schlüsselbund weiterlebt.
 * Deshalb gibt es überall, wo sie den Weg bestimmt, einen sichtbaren
 * Ausweg („Ich habe hier schon einen Passkey"). Falsch liegen darf sie —
 * nur nicht einsperren.
 *
 * Kein Cookie, keine Server-Spalte: Die Notiz gehört zum Gerät, nicht zum
 * Konto, und niemand sonst hat ein Interesse daran.
 */

const SCHLUESSEL = "tutr.passkey-auf-diesem-geraet";

/** Nach erfolgreicher Registrierung oder Anmeldung setzen. */
export function merkePasskeyAufDiesemGeraet(): void {
  try {
    window.localStorage.setItem(SCHLUESSEL, "1");
  } catch {
    // Privater Modus oder blockierter Speicher: Dann bleibt es beim
    // bisherigen Verhalten. Kein Grund, die Anmeldung scheitern zu lassen.
  }
}

/**
 * `true`, wenn hier schon einmal ein Passkey benutzt wurde. `false` heißt
 * **nicht** „es gibt keinen" – nur „wir wissen von keinem".
 */
export function kenntPasskeyAufDiesemGeraet(): boolean {
  try {
    return window.localStorage.getItem(SCHLUESSEL) === "1";
  } catch {
    // Im Zweifel den vertrauteren Weg anbieten, statt jemanden auszusperren.
    return true;
  }
}
