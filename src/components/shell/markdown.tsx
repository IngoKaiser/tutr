"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown für Tutor-Antworten (T-08).
 *
 * Das Modell schreibt strukturiert (`**fett**`, Listen, Absätze); vorher
 * stand das wörtlich im Chat. `react-markdown` rendert es – **ohne rohes
 * HTML**: Die Bibliothek interpretiert HTML im Text standardmäßig nicht
 * (dafür bräuchte es `rehype-raw`), damit ist der Weg XSS-frei, ohne dass
 * wir sanitizen müssten. `remark-gfm` ergänzt Tabellen, Durchstreichen und
 * Aufgabenlisten.
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
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
