/**
 * Icons der Designsprache (T-07a).
 *
 * Die Oberfläche ist bis hierher **rein typografisch**: dünne Linien,
 * Königsblau als „bedienbar", sonst Schrift. Die erste Fassung des
 * Tutor-Composers benutzte Emoji (🎤 🔊) – die brachten Farbe und eine
 * fremde Formensprache hinein und sehen auf jedem Betriebssystem anders
 * aus. Ersetzt durch flache Umriss-Icons:
 *
 * - **`currentColor`**, nie eine eigene Farbe: Das Icon erbt die Bedeutung
 *   seines Knopfes (Königsblau = bedienbar, `tinte-leise` = ruhend). Damit
 *   gilt die Regel aus `globals.css` auch hier – Akzent heißt *bedienbar*,
 *   nicht „gut".
 * - **Umriss statt Fläche**, Strichstärke 1,75 auf 24er-Raster: dieselbe
 *   Anmutung wie die Ein-Pixel-Rahmen der Blöcke. Einzige Ausnahme ist
 *   `StoppIcon` – ein gefülltes Quadrat, weil „läuft gerade" eine Fläche
 *   braucht, um sich vom Ruhezustand zu unterscheiden.
 * - **Kein Icon-Paket**: Für eine Handvoll Symbole wäre eine Abhängigkeit
 *   samt Tree-Shaking-Frage unverhältnismäßig (CLAUDE.md).
 *
 * Immer zusammen mit einem `aria-label` am Knopf verwenden – die Icons
 * selbst sind `aria-hidden`, sie tragen keine Bedeutung für Screenreader.
 */

type IconProps = {
  /** Kantenlänge in Pixeln. Standard 18 – passt in die 36er-Knöpfe des Composers. */
  size?: number;
  className?: string;
};

function Icon({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Diktieren (T-02b). */
export function MikrofonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.75a2.75 2.75 0 0 0-2.75 2.75v6a2.75 2.75 0 0 0 5.5 0v-6A2.75 2.75 0 0 0 12 2.75Z" />
      <path d="M18.25 11v.5a6.25 6.25 0 0 1-12.5 0V11" />
      <path d="M12 17.75v3.5" />
      <path d="M8.75 21.25h6.5" />
    </Icon>
  );
}

/** Läuft gerade – Aufnahme beenden. Gefüllt, damit „aktiv" ohne Farbe erkennbar bleibt. */
export function StoppIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/** Frage abschicken. */
export function SendenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19.25V5.5" />
      <path d="m5.75 11.75 6.25-6.25 6.25 6.25" />
    </Icon>
  );
}

/**
 * Der Lautsprecher-Körper, geteilt von An- und Aus-Zustand.
 *
 * Nutzt die volle Höhe des Rasters (4,5–19,5) – die erste Fassung war auf
 * halber Höhe gezeichnet und wirkte neben dem Mikrofon gedrungen.
 */
const LAUTSPRECHER_KOERPER = "M12 4.5 7.25 8.75H3.5v6.5h3.75L12 19.5V4.5Z";

/** Vorlesen ist an (T-02d). */
export function LautsprecherIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={LAUTSPRECHER_KOERPER} />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M18.25 6.75a7.25 7.25 0 0 1 0 10.5" />
    </Icon>
  );
}

/** Vorlesen ist aus. */
export function LautsprecherAusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={LAUTSPRECHER_KOERPER} />
      {/* Bewusst kompakter als die Wellen im An-Zustand: Ein breites Kreuz
          zieht das optische Gewicht nach rechts und lässt den Lautsprecher
          gedrungen wirken. */}
      <path d="m16 10 4 4" />
      <path d="m20 10-4 4" />
    </Icon>
  );
}

/** Zum Ende des Gesprächs springen (T-07). */
export function PfeilRunterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.75v14.5" />
      <path d="m18.25 13-6.25 6.25L5.75 13" />
    </Icon>
  );
}

/**
 * Abspielen (T-10). Wie `StoppIcon` eine **Fläche**, kein Umriss: Play und
 * Pause sind die beiden Zustände desselben Knopfes, und ein Dreieck als
 * Umriss läse sich neben dem gefüllten Pausenbalken wie ein anderes Symbol.
 */
export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 5.5a1 1 0 0 1 1.53-.85l8 6.5a1 1 0 0 1 0 1.7l-8 6.5A1 1 0 0 1 8 18.5z" />
    </svg>
  );
}

/** Pause (T-10) – das Gegenstück zu `PlayIcon`, ebenfalls gefüllt. */
export function PauseIcon({ size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <rect x="7" y="5.5" width="3.5" height="13" rx="1" />
      <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" />
    </svg>
  );
}

/** Kopieren (T-10) – zwei versetzte Blätter, Umriss wie die übrigen Icons. */
export function KopierenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Icon>
  );
}

/** Häkchen (T-10) – kurze Rückmeldung „kopiert“, verschwindet von selbst. */
export function HakenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

/** Anhang hinzufügen – öffnet das Plus-Menü im Composer (T-12). */
export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** Kamera – „Foto aufnehmen" im Plus-Menü (T-12). */
export function KameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 8.5a1.75 1.75 0 0 1 1.75-1.75h1.4a1 1 0 0 0 .86-.49l.68-1.14a1 1 0 0 1 .86-.49h4.4a1 1 0 0 1 .86.49l.68 1.14a1 1 0 0 0 .86.49h1.4a1.75 1.75 0 0 1 1.75 1.75v8.25a1.75 1.75 0 0 1-1.75 1.75H5.5a1.75 1.75 0 0 1-1.75-1.75Z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </Icon>
  );
}

/** Bild aus der Mediathek – „Foto auswählen" im Plus-Menü (T-12). */
export function BildIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="1.75" />
      <circle cx="8.75" cy="9.75" r="1.5" />
      <path d="M4.5 17.5l4.4-4.4a1.5 1.5 0 0 1 2.12 0l3.3 3.3a1.5 1.5 0 0 0 2.12 0l1.7-1.7a1.5 1.5 0 0 1 2.12 0l1.24 1.24" />
    </Icon>
  );
}

/**
 * Aufgabenblatt – „Hausaufgabe fotografieren" im Plus-Menü (T-16).
 *
 * Bewusst **kein** zweites Kamera-Icon, obwohl auch dieser Weg mit einem
 * Foto beginnt: Im selben Menü stünden sonst zwei Kameras nebeneinander, die
 * Verschiedenes tun – ein Foto an die Nachricht hängen gegenüber dem
 * Hausaufgaben-Ablauf aus §4a. Das Blatt zeigt, worum es geht, nicht womit
 * es anfängt.
 */
export function AufgabenblattIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.75h7.4L18.25 8v12.5a1.75 1.75 0 0 1-1.75 1.75h-10a1.75 1.75 0 0 1-1.75-1.75V5.5a1.75 1.75 0 0 1 1.75-1.75Z" />
      <path d="M13.75 3.9V8.25h4.35M8.5 12.5h7M8.5 16h4.5" />
    </Icon>
  );
}
