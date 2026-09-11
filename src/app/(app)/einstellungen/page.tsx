import { redirect } from "next/navigation";

import { Auslastungsbalken, Block, Notice, PageHeader } from "@/components/shell/primitives";
import { FENSTER_LABEL } from "@/lib/ai/rate-limit";
import { loginStatus } from "@/lib/auth/actor";

import {
  deleteChild,
  deleteMyAccount,
  deleteMyParentAccount,
  loadActiveSchoolYearLabel,
  loadAuslastung,
  loadDevices,
  loadOwnFirstName,
} from "./actions";
import { DeleteChild } from "./delete-child";
import { DeleteParentAccount } from "./delete-parent-account";
import { DeviceRow } from "./device-row";
import { RecoveryLink } from "./recovery-link";

export const metadata = { title: "Einstellungen · tutr" };

/**
 * Kindliste, Geräteliste des gerade gewählten Kindes, Löschen (F-06b, F-06e).
 *
 * Zwei völlig verschiedene Ansichten unter einer Route statt zwei Routen:
 * Ein Kind hat sonst keine eigene Einstellungsfläche, und „Konto löschen"
 * ist die einzige Aktion, die es dort braucht – eine zweite Route nur dafür
 * wäre mehr Fläche, nicht mehr Klarheit.
 *
 * Passkeys und Sitzungen stehen als **zwei** Listen, nicht zusammengeführt:
 * Ein Passkey trägt keinen Gerätenamen (wird nirgends gesetzt), eine Sitzung
 * den rohen User-Agent-String – beides ließe sich nur über eine erfundene
 * Heuristik einander zuordnen. Getrennt ist es ehrlicher als eine Vermutung.
 */
export default async function SettingsPage() {
  const { actor, login } = await loginStatus();
  if (!actor) redirect("/anmelden");

  if (actor.role === "student") {
    return <StudentSettings />;
  }

  if (!login) redirect("/heute");

  const [devices, schoolYearLabel] = await Promise.all([
    loadDevices(),
    loadActiveSchoolYearLabel(),
  ]);
  const currentStudent = login.students.find((s) => s.id === actor.studentId);

  return (
    <>
      <PageHeader title="Einstellungen" trailing={currentStudent?.firstName} />

      <div className="flex flex-col gap-3">
        <Block title="Kinder">
          <Notice>
            {login.students.length === 1
              ? `${login.students[0]!.firstName} ist mit diesem Elternkonto verknüpft.`
              : `Verknüpft: ${login.students.map((s) => s.firstName).join(", ")}. Wechseln Sie oben im Kopfbereich.`}
          </Notice>
        </Block>

        {schoolYearLabel ? (
          <Block title="Schuljahr" trailing={schoolYearLabel}>
            <Notice>
              {currentStudent?.firstName ?? "Ihr Kind"} legt Fächer selbst unter „Fächer&quot; an.
              Umschalten auf ein anderes Schuljahr kommt, sobald eins ansteht.
            </Notice>
          </Block>
        ) : null}

        <Block
          title="Passkeys"
          trailing={currentStudent ? `von ${currentStudent.firstName}` : undefined}
        >
          {!devices || devices.credentials.length === 0 ? (
            <Notice>Noch kein Passkey eingerichtet.</Notice>
          ) : (
            <ul className="flex flex-col gap-2">
              {devices.credentials.map((credential) => (
                <DeviceRow
                  key={credential.id}
                  id={credential.id}
                  label={credential.device_label ?? "Passkey ohne Namen"}
                  timestampLabel="zuletzt genutzt"
                  timestamp={credential.last_used_at}
                  action="removeCredential"
                  actionLabel="Entfernen"
                />
              ))}
            </ul>
          )}
        </Block>

        {currentStudent ? (
          // Kein `trailing` hier: „von {Name}" steht schon im Passkeys-Block
          // darüber – eine zweite gleichlautende Angabe wäre nicht nur
          // redundant, sondern für Tests, die auf den Text zielen, doppeldeutig.
          <Block title="Neues Gerät einrichten">
            <Notice>
              Passkey auf {currentStudent.firstName}s altem Gerät verloren oder ein neues Gerät
              dazu? Hier entsteht ein Link zum Einrichten.
            </Notice>
            <RecoveryLink firstName={currentStudent.firstName} />
          </Block>
        ) : null}

        <Block title="Angemeldete Geräte">
          {!devices || devices.sessions.length === 0 ? (
            <Notice>Keine aktive Sitzung.</Notice>
          ) : (
            <ul className="flex flex-col gap-2">
              {devices.sessions.map((session) => (
                <DeviceRow
                  key={session.id}
                  id={session.id}
                  label={session.device_label ?? "Unbekanntes Gerät"}
                  timestampLabel="zuletzt aktiv"
                  timestamp={session.last_seen_at}
                  action="revokeSession"
                  actionLabel="Abmelden"
                />
              ))}
            </ul>
          )}
        </Block>

        {currentStudent ? (
          <Block title="Kind entfernen">
            <DeleteChild
              firstName={currentStudent.firstName}
              buttonLabel="Kind entfernen"
              warning={`${currentStudent.firstName}s Konto wird unwiderruflich gelöscht – Lernstand, Karten, Vokabeln, Gespräche mit dem Tutor. Das lässt sich nicht rückgängig machen. ${currentStudent.firstName} wird darüber nicht benachrichtigt – sag es selbst weiter.`}
              action={deleteChild}
            />
          </Block>
        ) : null}

        <Block title="Elternkonto löschen">
          <Notice>
            Löscht nur Ihr eigenes Konto. Ihre Kinder bleiben unberührt und sind weiterhin über ihre
            eigenen Geräte erreichbar.
          </Notice>
          <DeleteParentAccount action={deleteMyParentAccount} />
        </Block>
      </div>
    </>
  );
}

/**
 * Nur-Lese-Zeilen plus die einzige Aktion, die ein Kind hier sonst braucht
 * (F-06e, F-16a) – und, seit S-03c, die volle Fortschrittsanzeige: nur das
 * Kind sieht `ai_usage`, dieselbe Richtung wie beim Tutor selbst.
 */
async function StudentSettings() {
  const [firstName, schoolYearLabel, auslastung] = await Promise.all([
    loadOwnFirstName(),
    loadActiveSchoolYearLabel(),
    loadAuslastung(),
  ]);

  return (
    <>
      <PageHeader title="Einstellungen" trailing={firstName ?? undefined} />
      {schoolYearLabel ? (
        <Block title="Schuljahr" trailing={schoolYearLabel}>
          <Notice>Deine Fächer legst du unter „Fächer&quot; an.</Notice>
        </Block>
      ) : null}
      {auslastung ? (
        <Block title="Tutor-Nutzung">
          <Notice>
            Wie viel du den Tutor gerade nutzt – Fragen und Fotos zusammen. Ist eine Leiste voll,
            macht der Tutor kurz Pause; deine Vokabeln, Karten und der Prüfungskalender laufen immer
            weiter.
          </Notice>
          <div className="flex flex-col gap-3">
            <Auslastungsbalken anteil={auslastung.stunde} label={FENSTER_LABEL.stunde} />
            <Auslastungsbalken anteil={auslastung.tag} label={FENSTER_LABEL.tag} />
            <Auslastungsbalken anteil={auslastung.woche} label={FENSTER_LABEL.woche} />
          </div>
        </Block>
      ) : null}
      <Block title="Konto löschen">
        <DeleteChild
          firstName={firstName ?? ""}
          buttonLabel="Konto löschen"
          warning="Dein Konto wird unwiderruflich gelöscht – Lernstand, Karten, Vokabeln, Gespräche mit dem Tutor. Das lässt sich nicht rückgängig machen. Ist ein Elternteil mit deinem Konto verknüpft, bekommt es eine Nachricht darüber."
          action={deleteMyAccount}
        />
      </Block>
    </>
  );
}
