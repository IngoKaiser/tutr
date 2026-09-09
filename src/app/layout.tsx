import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Newsreader } from "next/font/google";

import "./globals.css";

/**
 * Zwei Schnitte mit klarer Aufgabenteilung (Designsprache):
 * Grotesk für Bedienelemente, die überflogen werden – Serife für Erklärungen,
 * die gelesen werden.
 */
const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-familjen",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tutr",
  description: "Lernbegleitung fürs Schuljahr: Vokabeln, Karten, Prüfungen, Tutor.",
  applicationName: "tutr",
  appleWebApp: { capable: true, title: "tutr", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Königsblau, passend zur Designsprache – hell und dunkel getrennt.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#12151c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Vercel Web Analytics: aggregierte Seitenaufrufe ohne Cookies und ohne
 * personenbezogene Kennung – zählt Besuche, nicht Personen. Verwechselt
 * keinen Besuch mit einem Kind-Profil, kein Bezug zu Lernstand oder
 * Vokabeln. Gedacht für eine grobe Antwort auf „wird die App überhaupt
 * benutzt", nicht für „von wem" – dafür bräuchte es echte Lernzahlen aus
 * `review`/`card`, kein Tracking-Werkzeug.
 *
 * Nur in Produktion sinnvoll: `<Analytics />` selbst sendet ohnehin nichts
 * außerhalb von Vercel-Deployments, steht aber trotzdem einmal, nicht in
 * jeder Route einzeln.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${familjen.variable} ${newsreader.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
