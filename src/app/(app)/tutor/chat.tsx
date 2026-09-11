"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { HakenIcon, KopierenIcon, PauseIcon, PlayIcon } from "@/components/shell/icons";
import { TutorMarkdown } from "@/components/shell/markdown";
import { Block, ChatKopf, ContextChip, Notice } from "@/components/shell/primitives";
import type { Auslastung } from "@/lib/ai/rate-limit";
import type { PreparedImage } from "@/lib/image";
import { istEingeholt, naechsteLaenge } from "@/lib/tutor/stream-text";

import { ladeAuslastung, waehleFach, type SubjectChoice } from "./actions";
import { Composer, type ComposerAnhang } from "./composer";
import { useVorlesen, type VorlesenSteuerung } from "./use-speech";

/** Fester Hinweis unter jeder Tutor-Antwort (ADR 0010 D5) – der Server sagt das, nicht das Modell. */
const HERKUNFT = "Allgemeinwissen — noch ohne dein Material und dein Lehrwerk.";

const NICHT_EINGERICHTET =
  "Der Tutor ist gerade nicht eingerichtet. Deine Vokabeln, Karten und der Prüfungskalender funktionieren weiter.";

export type ChatMessage = { id: string; role: "nutzer" | "tutor"; content: string };

/**
 * Ein Tutor-Gespräch (T-02, umgebaut in T-07, T-13).
 *
 * Zwei Ebenen (wie ChatGPT und Claude): `/tutor` ist die Übersicht, hier ist
 * das Gespräch. Der Kopf trägt deshalb einen `back` auf die Übersicht –
 * `primitives.tsx` verlangt das für jede Seite unterhalb eines
 * Fußleisten-Bereichs, und genau das hatte die erste Fassung vergessen.
 *
 * `sessionId` ist `null`, solange das Gespräch nur gedacht ist: Erst die
 * erste Frage legt es an, dann wandert die URL per `replaceState` auf
 * `/tutor/<id>` – ohne Navigation, damit der laufende Stream nicht abreißt.
 * Seit T-13 (ADR 0013 D1) ist das **der Normalfall auf `/tutor` selbst**,
 * nicht mehr eine eigene `/tutor/neu`-Route mit vorgewählten Fach und
 * Einstieg: Die Übersicht rendert dieselbe Komponente mit `sessionId={null}`,
 * `subjectId={null}`, reicht die Historie über `leerInhalt` durch und zeigt
 * so lange keinen Kopf (kein Rückweg, kein Fach-Chip), bis ein Gespräch
 * tatsächlich existiert.
 *
 * `subjectId`/`subjectName`/`subjectLanguage` sind eigener State, nicht nur
 * Props (ADR 0013 D2/D4): Die erste Antwort kann das Fach erst zuordnen,
 * *nachdem* gesendet wurde – der Server trägt das Ergebnis in den
 * Antwort-Headern nach (`streameAntwort()`), und der Fach-Chip liest von
 * Hand über `waehleFach()` nach (D4).
 */
export function Conversation({
  sessionId: anfangsId,
  subjectId: anfangsSubjectId,
  subjectName: anfangsSubjectName,
  subjectLanguage: anfangsSubjectLanguage,
  topicTitle,
  entryPoint,
  initialMessages,
  available,
  auslastung: anfangsAuslastung,
  alleFaecher,
  leerInhalt,
}: {
  sessionId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectLanguage: string | null;
  topicTitle: string | null;
  entryPoint: "freie_frage" | "verstehen";
  initialMessages: ChatMessage[];
  available: boolean;
  /** Stand beim Öffnen der Seite; nach jeder Antwort frischt `ladeAuslastung()` ihn auf (S-03e). */
  auslastung: Auslastung | null;
  /** Für den Fach-Chip (ADR 0013 D4) – die Fächer, unter denen gewählt werden kann. */
  alleFaecher: SubjectChoice[];
  /**
   * Ersetzt den Standardhinweis, solange noch nichts geschrieben wurde. Auf
   * `/tutor` die Historie (ADR 0013 D1/D6) – an jeder anderen Stelle
   * ungesetzt, dann greift der übliche Platzhaltertext.
   */
  leerInhalt?: React.ReactNode;
}) {
  const [sessionId, setSessionId] = useState(anfangsId);
  const [subjectId, setSubjectId] = useState(anfangsSubjectId);
  const [subjectName, setSubjectName] = useState(anfangsSubjectName);
  const [subjectLanguage, setSubjectLanguage] = useState(anfangsSubjectLanguage);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [zielText, setZielText] = useState("");
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [anhang, setAnhang] = useState<ComposerAnhang | null>(null);
  const [auslastung, setAuslastung] = useState(anfangsAuslastung);
  const vorlesen = useVorlesen();
  const router = useRouter();

  // Geglätteter Textfluss: `zielText` ist, was angekommen ist, `streamText`,
  // was steht. Siehe `lib/tutor/stream-text.ts`.
  const streamText = useSanfterText(zielText, !pending);
  const { amEnde, sentinelRef, verlaufRef, nachUnten } = useAmEnde([messages, streamText]);
  useAutoVorlesen(messages, vorlesen);

  async function senden() {
    const frage = input.trim();
    // Ein Foto allein ist eine gültige Frage – der Server nimmt es auch ohne
    // Text an (`liesEingang()`), und „schau dir das mal an" ist genau das,
    // wofür der Anhang da ist.
    if ((!frage && !anhang) || pending) return;
    setInput("");
    setFehler(null);
    setPending(true);
    setMessages((prev) => [
      ...prev,
      { id: `lokal-${Date.now()}`, role: "nutzer", content: frage || "(Foto)" },
    ]);
    setZielText("");

    const bild = anhang?.datei ?? null;
    if (anhang) URL.revokeObjectURL(anhang.vorschauUrl);
    setAnhang(null);

    try {
      // ADR 0013 D1: Ohne `subjectId` (der Normalfall auf `/tutor` seit
      // T-13) schickt der Client gar kein Fach mit – der Server ordnet die
      // erste Nachricht selbst zu, statt eine leere Wahl zu erzwingen.
      const payload = sessionId
        ? { sessionId, message: frage, image: bild }
        : subjectId
          ? { subjectId, entryPoint, message: frage, image: bild }
          : { message: frage, image: bild };
      const { text, neueSessionId, fach, fortgesetzt } = await streameAntwort(payload, setZielText);
      setMessages((prev) => [...prev, { id: `tutor-${Date.now()}`, role: "tutor", content: text }]);
      if (!sessionId && neueSessionId) {
        setSessionId(neueSessionId);
        if (fortgesetzt) {
          // Die Frage ist in ein bestehendes Gespräch gewandert (ADR 0014 D1).
          // Hier reicht die Adresszeile **nicht**: Vor uns steht nur dieser
          // eine Austausch, das Modell kennt aber den ganzen Verlauf – eine
          // Antwort, die auf etwas von vorhin verweist, zeigte auf nichts.
          // `router.push` lädt das Gespräch wirklich, mit allem darin.
          router.push(`/tutor/${neueSessionId}`);
        } else {
          // URL nachziehen, ohne zu navigieren – ein Reload landet danach im
          // richtigen Gespräch, der Stream bleibt aber unangetastet.
          window.history.replaceState(null, "", `/tutor/${neueSessionId}`);
        }
      }
      // Das Fach steht erst jetzt fest (ADR 0013 D2) – der Server trägt es
      // in den Antwort-Headern nach, sonst zeigte der Chip weiter „Fach
      // wählen", obwohl längst zugeordnet ist.
      if (fach) {
        setSubjectId(fach.id);
        setSubjectName(fach.name);
        setSubjectLanguage(fach.language);
      }
      // Der Pegel im Composer zeigt sonst bis zum nächsten Seitenaufruf den
      // Stand von vorhin – gerade nach einer langen Antwort ist das die
      // Zahl, die sich am meisten bewegt hat.
      setAuslastung(await ladeAuslastung());
    } catch (problem) {
      setFehler(problem instanceof Error ? problem.message : "Da ging etwas schief.");
    } finally {
      setZielText("");
      setPending(false);
    }
  }

  const leer = messages.length === 0 && !streamText;

  return (
    // Drei Zonen statt eines Scrollbereichs (T-12a): Kopfzeile fest,
    // **nur die Nachrichten scrollen**, Eingabefeld fest. Vorher hingen
    // Kopfzeile und Composer als `sticky` im scrollenden `main` – auf dem
    // Desktop tadellos, auf dem iPhone aber rutschte das Eingabefeld beim
    // Scrollen mit nach oben und ließ eine leere Fläche darunter stehen
    // (iOS rendert `position: sticky` im Momentum-Scrolling nicht
    // zuverlässig nach). Was nicht im Scrollbereich liegt, kann auch nicht
    // mitrutschen.
    //
    // Pinnen geht nur mit einer **definierten** Höhe. `100cqh` ist die von
    // `main` (Größen-Container, siehe `(app)/layout.tsx`), minus 2,5 rem für
    // das `py-5` der Hülle darin – Kopfzeile und Composer holen sich diesen
    // Rand über `-mt-5`/`-mb-5` ohnehin zurück.
    <div className="flex h-[calc(100cqh-2.5rem)] min-h-0 flex-col">
      {/* **Die Kopfzeile ist immer da** (T-16). Sie hing bis dahin an
          `sessionId` – lokalem State, der erst gesetzt wird, wenn die erste
          Antwort **fertig** gestreamt ist. Dadurch gab es auf `/tutor` vom
          Absenden bis zum Ende der Antwort keinen Rückweg, und wenn der
          Stream abbrach (Netz, Rate Limit), blieb er ganz weg: Der
          `catch`-Zweig setzt nur die Fehlermeldung, `setSessionId` wird nie
          erreicht. Beim Testen am Gerät genau so aufgefallen – „zurück ging
          nicht, danach ließ es sich nicht reproduzieren" (nach einem Reload
          ist man wieder auf der Übersicht).

          Zwei Gestalten, eine Zeile: Ohne Gespräch der Seitentitel wie auf
          jeder anderen Wurzel (Heute, Fächer, Üben, Prüfungen – der Tutor
          war die einzige ohne), im Gespräch Rückweg und Fach-Chip.

          Der Umschaltpunkt ist `leer`, **nicht** `sessionId`: Sobald die
          erste Frage abgeschickt ist, ist man sichtbar im Gespräch (Historie
          weg, Sprechblasen da) – und genau dann soll der Rückweg da sein,
          nicht erst wenn die Antwort steht. Er führt auf `/tutor` und damit
          zur Historie, in der das Gespräch schon auftaucht: Die Frage wird
          vor dem Modellaufruf geschrieben (ADR 0010 D1). Der Fach-Chip
          hängt weiter an `sessionId` – ohne Session gibt es nichts
          zuzuordnen.

          Die Leiste selbst steckt seit T-18 in `ChatKopf` – sie stand hier
          und im Hausaufgaben-Dialog zweimal fast gleich im Code. */}
      <ChatKopf
        titel={leer && !sessionId ? "Tutor" : undefined}
        zurueck={leer && !sessionId ? undefined : { href: "/tutor", label: "Gespräche" }}
      >
        {sessionId ? (
          <FachChip
            sessionId={sessionId}
            subjectName={subjectName}
            topicTitle={topicTitle}
            alleFaecher={alleFaecher}
            onGewaehlt={(fach) => {
              setSubjectId(fach.id);
              setSubjectName(fach.name);
              setSubjectLanguage(fach.language);
            }}
          />
        ) : null}
      </ChatKopf>

      {/* Die einzige scrollende Fläche. `min-h-0`, sonst weigert sich das
          Flex-Kind zu schrumpfen und schiebt den Composer aus dem Bild.

          `-mx-4 px-4` (T-16): Der Scrollbereich reicht bis an den
          Bildschirmrand, das Polster liegt **innen**. Vorher endete er am
          `px-4` der Hülle – iOS zeichnet seine überlagernde Bildlaufleiste
          am rechten Rand des Scrollcontainers, also mitten über den Karten
          und Sprechblasen statt daneben. */}
      <div
        ref={verlaufRef}
        className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
      >
        {leer ? (
          (leerInhalt ?? (
            <Notice>
              {entryPoint === "verstehen"
                ? "Erzähl, was ihr gemacht habt und wo du aussteigst."
                : "Stell deine Frage — der Tutor kennt dein Fach, aber noch nicht dein Material."}
            </Notice>
          ))
        ) : (
          <ol className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} vorlesen={vorlesen} />
            ))}
            {streamText ? (
              <MessageBubble
                message={{ id: "live", role: "tutor", content: streamText }}
                vorlesen={vorlesen}
                live
              />
            ) : null}
          </ol>
        )}

        {fehler ? <Notice>{fehler}</Notice> : null}

        {/* Der Anker, an dem „bin ich unten?“ gemessen wird. */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      </div>

      {available ? (
        <Composer
          wert={input}
          onChange={setInput}
          onSend={() => void senden()}
          pending={pending}
          platzhalter={
            subjectLanguage ? "Frag etwas — auf Deutsch." : "Frag etwas oder sag, wo es hakt."
          }
          vorlesen={vorlesen}
          auslastung={auslastung}
          amEnde={amEnde}
          nachUnten={nachUnten}
          anhang={anhang}
          onAnhang={setAnhang}
          hausaufgabeHref="/tutor/hausaufgabe/neu"
        />
      ) : (
        <Block>
          <Notice>{NICHT_EINGERICHTET}</Notice>
        </Block>
      )}
    </div>
  );
}

// --- Fach-Chip ---------------------------------------------------------

/**
 * Der antippbare Kontext-Chip (T-13, ADR 0013 D4): zeigt das zugeordnete
 * Fach, oder „Fach wählen", wenn die Zuordnung „unklar" ergab. Ein Tipp öffnet
 * ein kleines Menü mit den Fächern des Kindes; die Wahl schreibt sofort über
 * `waehleFach()` und optimistisch in den State des Aufrufers (`onGewaehlt`) –
 * kein Neuladen der Seite nötig.
 *
 * Ohne Fächer (Kind hat noch keins angelegt) bleibt der Chip eine reine
 * Anzeige: Ein Menü ohne Einträge wäre nur ein Tipp ins Leere.
 */
function FachChip({
  sessionId,
  subjectName,
  topicTitle,
  alleFaecher,
  onGewaehlt,
}: {
  sessionId: string;
  subjectName: string | null;
  topicTitle: string | null;
  alleFaecher: SubjectChoice[];
  onGewaehlt: (fach: SubjectChoice) => void;
}) {
  const [offen, setOffen] = useState(false);
  const menueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!menueRef.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);

  if (alleFaecher.length === 0) {
    return <ContextChip subject={subjectName} topic={topicTitle} />;
  }

  return (
    <div ref={menueRef} className="relative">
      <ContextChip subject={subjectName} topic={topicTitle} onClick={() => setOffen((o) => !o)} />
      {offen ? (
        <div className="border-linie-stark bg-flaeche absolute top-9 left-0 z-20 flex w-44 flex-col overflow-hidden rounded-[10px] border shadow-lg">
          {alleFaecher.map((fach, i) => (
            <button
              key={fach.id}
              type="button"
              onClick={() => {
                setOffen(false);
                onGewaehlt(fach);
                void waehleFach(sessionId, fach.id);
              }}
              className={`text-tinte hover:bg-papier-tief px-3 py-2 text-left text-[0.8125rem] ${
                i === 0 ? "" : "border-linie border-t"
              }`}
            >
              {fach.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// --- Nachrichten ------------------------------------------------------

function MessageBubble({
  message,
  vorlesen,
  live = false,
}: {
  message: ChatMessage;
  vorlesen: VorlesenSteuerung;
  live?: boolean;
}) {
  const istTutor = message.role === "tutor";
  const laeuft = vorlesen.sprichtId === message.id && !vorlesen.pausiert;
  const angehalten = vorlesen.sprichtId === message.id && vorlesen.pausiert;
  const [kopiert, setKopiert] = useState(false);
  const kopierTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (kopierTimer.current !== null) window.clearTimeout(kopierTimer.current);
    },
    [],
  );

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(message.content);
      setKopiert(true);
      if (kopierTimer.current !== null) window.clearTimeout(kopierTimer.current);
      kopierTimer.current = window.setTimeout(() => setKopiert(false), 1600);
    } catch {
      // Ohne Recht auf die Zwischenablage bleibt es beim Versuch – kein
      // Grund, dem Kind eine Fehlermeldung hinzustellen.
    }
  }
  return (
    <li className={`flex flex-col gap-1 ${istTutor ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[85%] rounded-[10px] border px-3 py-2 text-sm ${
          istTutor
            ? "border-linie bg-papier text-tinte"
            : "border-koenigsblau bg-koenigsblau-hell text-tinte whitespace-pre-wrap"
        }`}
      >
        {istTutor ? (
          // Markdown erst rendern, wenn die Antwort steht (T-08). Während des
          // Streamens Klartext: halbfertiges Markdown (`**` ohne Ende) würde
          // sonst bei jedem Wort umspringen.
          live ? (
            <span className="whitespace-pre-wrap">
              {message.content}
              <span className="text-tinte-leise"> ▍</span>
            </span>
          ) : (
            <TutorMarkdown>{message.content}</TutorMarkdown>
          )
        ) : (
          message.content
        )}
      </div>
      {istTutor && !live ? (
        <div className="flex items-center gap-1">
          <NachrichtAktion label="Antwort kopieren" onClick={() => void kopieren()}>
            {kopiert ? <HakenIcon size={15} /> : <KopierenIcon size={15} />}
          </NachrichtAktion>
          {vorlesen.verfuegbar ? (
            <NachrichtAktion
              label={laeuft ? "Vorlesen anhalten" : angehalten ? "Weiterlesen" : "Vorlesen"}
              aktiv={laeuft || angehalten}
              onClick={() => {
                if (laeuft) vorlesen.pause();
                else if (angehalten) vorlesen.weiter();
                else vorlesen.liesVor(message.id, message.content);
              }}
            >
              {laeuft ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
            </NachrichtAktion>
          ) : null}
          <span className="text-tinte-leise ml-1 text-[0.6875rem]">{HERKUNFT}</span>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Ein kleiner Icon-Knopf unter einer Tutor-Antwort (T-10).
 *
 * Ersetzt die frühere Textschaltfläche „Vorlesen“/„Stopp“. Zwei Gründe:
 * Der Zustand „läuft gerade“ gehört ins Symbol (Play/Pause), nicht in
 * wechselnden Text – und zum Vorlesen kam mit dem Kopieren eine zweite
 * Aktion dazu, für die zwei nebeneinanderstehende Wörter zu laut wären.
 *
 * Die Bedeutung trägt das `aria-label`, nicht das Icon (`icons.tsx`).
 */
function NachrichtAktion({
  label,
  onClick,
  aktiv = false,
  children,
}: {
  label: string;
  onClick: () => void;
  aktiv?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`focus-visible:outline-koenigsblau flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ${
        aktiv ? "text-koenigsblau" : "text-tinte-leise hover:text-koenigsblau"
      }`}
    >
      {children}
    </button>
  );
}

// --- Haken -----------------------------------------------------------

/** Gibt den angekommenen Text gleichmäßig frei statt in Schüben (T-07). */
function useSanfterText(ziel: string, fertig: boolean): string {
  const [laenge, setLaenge] = useState(0);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      setLaenge((bisher) => {
        // Deckt auch den Rücksprung auf 0 ab (neue Antwort): `naechsteLaenge`
        // folgt einer Korrektur nach unten sofort.
        const naechste = naechsteLaenge(bisher, ziel.length, fertig);
        if (!istEingeholt(naechste, ziel.length)) id = requestAnimationFrame(tick);
        return naechste;
      });
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [ziel, fertig]);

  return ziel.slice(0, laenge);
}

/** So nah am Ende gilt noch als „unten“ (Pixel). */
const ENDE_TOLERANZ = 64;

/**
 * „Klebt“ der Blick am Ende? (T-07, neu gebaut in T-10.)
 *
 * Gemessen wird jetzt direkt am **Scroll-Container** – das ist `main` aus
 * dem App-Rahmen, gefunden über `closest()` vom Anker aus. Vorher hing das
 * an einem `IntersectionObserver`: Der meldet nichts, solange das Dokument
 * verborgen ist, und ließ den Pfeil nach unten damit auch dann aus, wenn er
 * gebraucht wurde. Eine Abfrage von `scrollTop`/`scrollHeight` ist
 * deterministisch, im Test nachvollziehbar und kennt keine solchen Löcher.
 *
 * Nebenwirkung, die eigentlich der Hauptpunkt ist: Mit dem Container in der
 * Hand lässt sich ein Gespräch beim Öffnen **ganz nach unten** setzen –
 * dorthin, wo man weiterliest.
 */
function useAmEnde(abhaengigkeiten: readonly unknown[]) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const verlaufRef = useRef<HTMLDivElement>(null);
  const [amEnde, setAmEnde] = useState(true);

  // Seit T-12a scrollt nicht mehr `main`, sondern der Verlauf selbst – der
  // Ref zeigt direkt darauf. Das `closest("main")` von vorher fände jetzt
  // einen Container, der gar nicht mehr scrollt, und der ↓-Knopf käme nie
  // wieder zum Vorschein.
  const behaelter = useCallback(() => verlaufRef.current, []);

  const springAnsEnde = useCallback(
    (sanft: boolean) => {
      const el = behaelter();
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: sanft ? "smooth" : "auto" });
    },
    [behaelter],
  );

  /** Für den Pfeil-Knopf – ohne Argument, damit kein Klick-Ereignis durchrutscht. */
  const nachUnten = useCallback(() => springAnsEnde(true), [springAnsEnde]);

  useEffect(() => {
    const el = behaelter();
    if (!el) return;
    const messen = () =>
      setAmEnde(el.scrollHeight - el.scrollTop - el.clientHeight <= ENDE_TOLERANZ);
    messen();
    el.addEventListener("scroll", messen, { passive: true });
    window.addEventListener("resize", messen);
    return () => {
      el.removeEventListener("scroll", messen);
      window.removeEventListener("resize", messen);
    };
  }, [behaelter]);

  // Beim Öffnen ans Ende, ohne Animation (T-10): Ein gespeichertes Gespräch
  // soll dort aufgehen, wo es aufgehört hat, nicht am Anfang. Zweimal, weil
  // Markdown und Schriften die Höhe nach dem ersten Layout noch ändern.
  useLayoutEffect(() => {
    springAnsEnde(false);
    const id = requestAnimationFrame(() => springAnsEnde(false));
    return () => cancelAnimationFrame(id);
  }, [springAnsEnde]);

  // Solange der Blick unten klebt, mitscrollen – wer hochgescrollt hat, wird
  // nicht zurückgerissen (das ist der Punkt, an dem sich Chats unangenehm
  // anfühlen).
  useEffect(() => {
    if (amEnde) springAnsEnde(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst an den übergebenen Werten statt an einer festen Liste
  }, [amEnde, springAnsEnde, ...abhaengigkeiten]);

  return { amEnde, sentinelRef, verlaufRef, nachUnten };
}

/** Liest eine neu hinzugekommene Tutor-Antwort vor, wenn „immer vorlesen“ an ist (ADR 0011 D2). */
function useAutoVorlesen(messages: ChatMessage[], vorlesen: VorlesenSteuerung) {
  const zuletztRef = useRef<string | null>(null);
  const bereitRef = useRef(false);
  const { immerAn, liesVor } = vorlesen;
  useEffect(() => {
    const erstesMal = !bereitRef.current;
    bereitRef.current = true;

    const letzte = messages[messages.length - 1];
    if (!letzte || letzte.role !== "tutor") return;

    /**
     * Beim Öffnen nur merken, nicht vorlesen (T-10). Ein gespeichertes
     * Gespräch soll nicht von selbst lossprechen – und auf iOS wird ein
     * `speak()` ohne vorausgegangene Nutzergeste ohnehin verworfen, wobei
     * weder `onend` noch `onerror` feuert: Genau daher kam der Knopf, der
     * beim Öffnen auf „Stopp“ stand, obwohl nichts lief.
     */
    if (erstesMal) {
      zuletztRef.current = letzte.id;
      return;
    }

    if (letzte.id === zuletztRef.current) return;
    zuletztRef.current = letzte.id;
    if (immerAn) liesVor(letzte.id, letzte.content);
  }, [messages, immerAn, liesVor]);
}

// --- Stream lesen ----------------------------------------------------

/**
 * Drei Formen: ein bestehendes Gespräch (`sessionId`), ein neues mit
 * expliziter Fachwahl (`subjectId` + `entryPoint` – der Übergangspfad,
 * solange irgendeine Oberfläche ihn noch anbietet), oder seit T-13 (ADR 0013
 * D1) der Normalfall auf `/tutor`: **kein Fach mitgeschickt**, der Server
 * ordnet die erste Nachricht selbst zu.
 */
type SendePayload =
  | { sessionId: string; message: string; image: PreparedImage | null }
  | {
      subjectId: string;
      entryPoint: "freie_frage" | "verstehen";
      message: string;
      image: PreparedImage | null;
    }
  | { message: string; image: PreparedImage | null };

/**
 * Schickt die Frage an `POST /api/tutor` und reicht den bisher angekommenen
 * Text an `onDelta` weiter. Wirft mit der Server-Fehlermeldung (deutscher
 * Satz), wenn die Antwort kein 2xx ist – auch das Rate-Limit (429) landet so
 * als lesbarer Hinweis in der Oberfläche.
 *
 * `fach` kommt aus den Antwort-Headern (ADR 0013 D2/D4) – der einzige Weg,
 * auf dem der Client erfährt, welches Fach eine gerade erst gelaufene
 * Zuordnung getroffen hat, ohne die Seite neu zu laden.
 */
async function streameAntwort(
  payload: SendePayload,
  onDelta: (voll: string) => void,
): Promise<{
  text: string;
  neueSessionId: string | null;
  fach: { id: string; name: string; language: string | null } | null;
  /** Die Frage ist in ein bestehendes Gespräch gewandert (ADR 0014 D1). */
  fortgesetzt: boolean;
}> {
  const res = await fetch("/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const grund = (await res.text().catch(() => "")) || "Der Tutor antwortet gerade nicht.";
    throw new Error(grund);
  }

  const neueSessionId = res.headers.get("x-tutor-session");
  const fortgesetzt = res.headers.get("x-tutor-fortgesetzt") === "1";
  const fachId = res.headers.get("x-tutor-subject-id");
  const fachNameRoh = res.headers.get("x-tutor-subject-name");
  const fachSprache = res.headers.get("x-tutor-subject-language");
  const fach =
    fachId && fachNameRoh
      ? { id: fachId, name: decodeURIComponent(fachNameRoh), language: fachSprache || null }
      : null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let voll = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    voll += decoder.decode(value, { stream: true });
    onDelta(voll);
  }

  return { text: voll, neueSessionId, fach, fortgesetzt };
}
