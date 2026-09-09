import type { MetadataRoute } from "next";

/**
 * Diese App gehört nicht in eine Suchmaschine (D-01).
 *
 * Sie ist keine Website, sondern das Lernkonto eines Kindes: Vorname,
 * Jahrgang, Vokabeln, Lernstand. Selbst wenn alle Seiten hinter einer
 * Anmeldung liegen, sollen weder `/anmelden` noch `/registrieren` in einem
 * Suchindex auftauchen – eine Adresse, die man kennt, statt einer, die man
 * findet.
 *
 * `robots.txt` ist dabei nur die Bitte; die Durchsetzung steht als
 * `X-Robots-Tag` in den Antwort-Headern (`next.config.ts`), weil der auch
 * für Antworten gilt, die kein HTML sind.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
