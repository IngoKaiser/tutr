import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";

import { loadDevices } from "./actions";
import { DeviceRow } from "./device-row";
import { RecoveryLink } from "./recovery-link";

export const metadata = { title: "Einstellungen · tutr" };

/**
 * Bewusst schmal (F-06b): Kindliste und Geräteliste des gerade gewählten
 * Kindes, mehr nicht. Das Löschen eines Kontos kommt mit F-06e dazu, wenn
 * die Regeln dafür feststehen – kein Platzhalter davor.
 *
 * Passkeys und Sitzungen stehen als **zwei** Listen, nicht zusammengeführt:
 * Ein Passkey trägt keinen Gerätenamen (wird nirgends gesetzt), eine Sitzung
 * den rohen User-Agent-String – beides ließe sich nur über eine erfundene
 * Heuristik einander zuordnen. Getrennt ist es ehrlicher als eine Vermutung.
 */
export default async function SettingsPage() {
  const { actor, login } = await loginStatus();
  if (!actor || actor.role !== "parent" || !login) redirect("/heute");

  const devices = await loadDevices();
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
      </div>
    </>
  );
}
