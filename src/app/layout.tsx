import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tutr",
  description: "Lernbegleitung fürs Schuljahr: Vokabeln, Karten, Prüfungen, Tutor.",
  applicationName: "tutr",
  appleWebApp: { capable: true, title: "tutr", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
