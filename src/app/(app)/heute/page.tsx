import { redirect } from "next/navigation";

import { Block, LinkButton, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";
import {
  countdownLabel,
  daysUntil,
  eventTypeLabel,
  istBald,
  langesDatum,
} from "@/lib/calendar/upcoming";

import { loadDueBySubject, type DueBySubject } from "../ueben/actions";
import { loadNaechstenTermin, type NaechsterTermin } from "./actions";

export const metadata = { title: "Heute · tutr" };

/**
 * Konzept §5: „in 10–15 Minuten etwas Sinnvolles tun, ohne zu suchen."
 *
 * Seit H-01 mit echten Zahlen statt der Attrappe aus F-07. Die Seite ist
 * **Agenda, nicht Werkzeug**: Sie zeigt, was ansteht, und startet die beiden
 * Orte, an denen tatsächlich gearbeitet wird – `/ueben` und den Tutor. Jede
 * Zahl hier gehört woanders hin und wird dort auch gezeigt; „Heute"
 * wiederholt sie nur in der Reihenfolge des Tages.
 *
 * Was §5 darüber hinaus vorsieht (Lernplan-Slot, Fördern-/Fordern-Karte,
 * Sommer-Assistent), fehlt bewusst – die Module dahinter gibt es noch nicht,
 * siehe `actions.ts`.
 *
 * Der Stichtag wird einmal serverseitig gesetzt und für Kopfzeile **und**
 * Countdown benutzt (UTC, wie `/pruefungen`), damit beide denselben Tag
 * meinen.
 */
export default async function TodayPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const istKind = actor.role === "student";
  const todayISO = new Date().toISOString().slice(0, 10);
  const [faellig, termin] = await Promise.all([
    istKind ? loadDueBySubject() : Promise.resolve(null),
    loadNaechstenTermin(todayISO),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Heute" trailing={langesDatum(todayISO)} />

      {termin ? <TerminBlock termin={termin} todayISO={todayISO} /> : null}

      {istKind ? (
        <>
          <FaelligBlock faellig={faellig} />

          {/* §5: „‚Hausaufgabe' ist der prominenteste Chip und zusätzlich als
              Kamera-Button auf ‚Heute' erreichbar." Der Weg führt über die
              Tutor-Übersicht statt direkt in die Aufnahme: Welches Fach, weiß
              nur das Kind, und die Auswahl steht dort schon – ein zweiter
              Fachwähler hier wäre dieselbe Frage an zwei Orten. */}
          <LinkButton href="/tutor?einstieg=hausaufgabe" quiet>
            Hausaufgabe fotografieren
          </LinkButton>
        </>
      ) : (
        /* Eltern sehen den Termin – der Kalender gehört ausdrücklich beiden
           (ADR 0004 D4) –, aber keinen Lernstand: fällige Karten sind genau
           das „wie gut läuft es", das ADR 0012 D3 ihnen entzieht. Der
           Hausaufgaben-Knopf fehlt aus demselben Grund; er führte ohnehin in
           einen Bereich, der für Eltern leer ist (ADR 0010 D2).
           **Die RLS zieht erst mit F-17 nach** – bis dahin ist diese Weiche
           die Oberflächenseite derselben Entscheidung, nicht ihr Ersatz. */
        <Block title="Lernstand">
          <Notice>
            Was heute ansteht und wie es läuft, sieht Ihr Kind selbst. Für Sie sind Termine, Fächer
            und das Schuljahr da.
          </Notice>
        </Block>
      )}
    </div>
  );
}

/**
 * Der nächste Termin mit Countdown (§5). Hervorgehoben nur, wenn er in
 * höchstens einer Woche ist (`istBald()`) – ein Kasten, der vier Wochen lang
 * leuchtet, hebt nichts mehr hervor.
 *
 * Der Knopf führt in den Kalender, nicht in eine Vorbereitung: Die
 * Prüfungsvorbereitungs-Seite aus §15 kommt mit P-01. Lieber ein Link, der
 * hält, was er sagt.
 */
function TerminBlock({ termin, todayISO }: { termin: NaechsterTermin; todayISO: string }) {
  const tage = daysUntil(termin.date, new Date(`${todayISO}T00:00:00Z`));

  return (
    <Block
      title={`${termin.subjectName} · ${eventTypeLabel(termin.type)}`}
      trailing={countdownLabel(tage)}
      emphasized={istBald(tage)}
    >
      <Notice>{termin.title}</Notice>
      <LinkButton href="/pruefungen" quiet>
        Alle Termine
      </LinkButton>
    </Block>
  );
}

/**
 * Fällige Vokabeln je Fach – dieselbe Zahl wie unter „Üben" (ADR 0008 D3:
 * nie eine Zahl über alle Fächer hinweg).
 *
 * Hier steht nur, **was** fällig ist, nicht der Lernstand dazu: Die drei
 * Stapel („Neu / Am Üben / Sitzt") gehören auf die Seite, auf der geübt
 * wird. „Heute" beantwortet eine Frage – was ist dran? –, und je weniger
 * daneben steht, desto schneller ist sie beantwortet.
 */
function FaelligBlock({ faellig }: { faellig: DueBySubject[] | null }) {
  if (faellig === null) {
    return (
      <Block title="Fällig heute">
        <Notice>Zahlen sind gerade nicht verfügbar.</Notice>
      </Block>
    );
  }

  if (faellig.length === 0) {
    return (
      <Block title="Fällig heute">
        <Notice>Nichts fällig. Deine Vokabeln melden sich, wenn sie dran sind.</Notice>
      </Block>
    );
  }

  const gesamt = faellig.reduce((summe, fach) => summe + fach.total, 0);

  return (
    <Block title="Fällig heute" trailing={`${gesamt} ${gesamt === 1 ? "Vokabel" : "Vokabeln"}`}>
      <ul className="flex flex-col gap-1.5">
        {faellig.map((fach) => (
          <li key={fach.subjectId} className="flex items-baseline justify-between gap-3">
            <span className="text-tinte text-[0.8125rem]">{fach.subjectName}</span>
            <span className="text-tinte-leise shrink-0 text-[0.75rem] tabular-nums">
              {fach.total} fällig
            </span>
          </li>
        ))}
      </ul>
      <LinkButton href="/ueben">Üben</LinkButton>
    </Block>
  );
}
