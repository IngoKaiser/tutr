"use client";

import "katex/dist/katex.min.css";
// Erweitert KaTeX um `\ce{…}` für Summenformeln und Reaktionsgleichungen
// (T-14). Muss **vor** dem ersten Rendern geladen sein; der Import registriert
// die Makros global auf der KaTeX-Instanz, die `rehype-katex` benutzt.
import "katex/contrib/mhchem";
import rehypeKatex from "rehype-katex";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Markdown für Tutor-Antworten (T-08, Formeln und Zeilenumbrüche in T-14).
 *
 * Das Modell schreibt strukturiert (`**fett**`, Listen, Absätze); vorher
 * stand das wörtlich im Chat. `react-markdown` rendert es – **ohne rohes
 * HTML**: Die Bibliothek interpretiert HTML im Text standardmäßig nicht
 * (dafür bräuchte es `rehype-raw`), damit ist der Weg XSS-frei, ohne dass
 * wir sanitizen müssten.
 *
 * **Vier Plugins, drei davon aus T-14:**
 *
 * - `remark-gfm` – Tabellen, Durchstreichen, Aufgabenlisten (T-08).
 * - `remark-breaks` – **ein** Zeilenumbruch ist ein Zeilenumbruch. In
 *   Standard-Markdown fällt er weg, Absätze entstehen nur mit Leerzeile.
 *   Genau daran klebten Rechenschritte aneinander: Das Modell schrieb
 *   `7x − 4x − 9 = 15` und `3x − 9 = 15` auf zwei Zeilen, gerendert stand
 *   beides hintereinander in einer, nur durch Fettung unterscheidbar
 *   (gefunden beim Testen einer Hausaufgabe). Das Plugin arbeitet auf dem
 *   Syntaxbaum und lässt Code-Blöcke und Tabellen in Ruhe – eine
 *   Textersetzung auf dem Rohtext hätte genau die zerlegt.
 * - `remark-math` + `rehype-katex` – `$…$` und `$$…$$` werden zu echtem
 *   Formelsatz. KaTeX lag seit F-01 als Abhängigkeit im Projekt, ohne je
 *   benutzt zu werden; CLAUDE.md verlangt es ausdrücklich („Formeln mit
 *   KaTeX. Kein MathJax."). `throwOnError: false` ist wichtig: Eine
 *   Modellantwort mit kaputtem LaTeX soll die rote Stelle zeigen, nicht die
 *   ganze Seite mitreißen.
 *
 * Die `components`-Abbildung bindet jedes Element an die Designtokens –
 * keine Prosa-Serifenschrift wie bei `ReadingText`, sondern der normale
 * Chat-Fließtext, nur mit Struktur. Überschriften bewusst klein gehalten:
 * Der Systemprompt verbietet sie bei kurzen Antworten, aber wenn doch eine
 * kommt, soll sie den Chat nicht sprengen.
 *
 * Nur für `role = 'tutor'`. Was das Kind tippt, bleibt Klartext.
 */

const components: Components = {
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-tinte font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-1.5 flex list-disc flex-col gap-1 pl-5 leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 flex list-decimal flex-col gap-1 pl-5 leading-relaxed">{children}</ol>
  ),
  li: ({ children }) => <li className="marker:text-tinte-leise">{children}</li>,
  h1: ({ children }) => <p className="text-tinte mt-2 mb-1 font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="text-tinte mt-2 mb-1 font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="text-tinte mt-2 mb-1 font-semibold first:mt-0">{children}</p>,
  code: ({ children }) => (
    <code className="bg-papier-tief text-tinte rounded px-1 py-0.5 font-mono text-[0.8125em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-papier-tief text-tinte my-1.5 overflow-x-auto rounded-[8px] p-2.5 font-mono text-[0.8125em] leading-normal">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-koenigsblau underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-linie-stark text-tinte-weich my-1.5 border-l-2 pl-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-linie my-2" />,
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="border-linie w-full border-collapse border text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-linie bg-papier-tief border px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-linie border px-2 py-1">{children}</td>,
};

export function TutorMarkdown({ children }: { children: string }) {
  return (
    // `[&_.katex-display]:overflow-x-auto`: Eine abgesetzte Gleichung kann
    // breiter sein als die Sprechblase – auf dem Handy fast immer. Sie
    // scrollt dann in sich, statt die Blase zu sprengen oder die ganze Seite
    // seitlich schiebbar zu machen. Der engere Abstand darüber/darunter
    // (Standard sind 1em) hält den Chat kompakt.
    <div className="text-sm [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
