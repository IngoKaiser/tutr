/**
 * Ein Foto fürs Hochladen vorbereiten (V-03b).
 *
 * Läuft im Browser, **bevor** das Bild an die Server Action geht. Drei
 * Gründe, alle drei praktisch:
 *
 * 1. **Größe.** Server Actions nehmen standardmäßig 1 MB entgegen, ein
 *    Handyfoto wiegt 2–5 MB. Statt das Limit hochzudrehen, schrumpft das
 *    Bild – die kleinere Datei ist auch auf einer Handyverbindung schneller
 *    oben.
 * 2. **Keine verlorene Qualität.** Die Bilderkennung rechnet ohnehin auf
 *    ungefähr diese Kantenlänge herunter; mehr Pixel zu schicken kostet
 *    Übertragung, ohne dass mehr erkannt würde.
 * 3. **Metadaten.** Das Neu-Zeichnen über ein Canvas überträgt die
 *    EXIF-Daten nicht mit – Aufnahmeort und Gerät bleiben auf dem Telefon.
 *    Zu ADR 0007 D6 („das Foto wird nicht gespeichert") passt, das GPS
 *    dann auch gar nicht erst zu verschicken.
 *
 * Der Haken an Punkt 3: Die EXIF-Orientierung fällt mit weg. Ein Handy legt
 * ein quergehaltenes Foto oft aufrecht im Speicher ab und notiert „drehen"
 * nur im Tag – ohne den landet die Buchseite um 90° gekippt auf dem Canvas
 * und genau so bei der Bilderkennung, die gedrehte Zeilen schlecht liest.
 * `createImageBitmap(file, { imageOrientation: "from-image" })` backt die
 * Drehung vor dem Zeichnen in die Pixel; erst danach wirft das Canvas den
 * Rest der Metadaten weg.
 */

/** Lange Kante nach dem Verkleinern. Darüber bringt es der Erkennung nichts. */
const MAX_EDGE = 1568;

/** JPEG statt PNG: Fotos, kein Strichbild – bei ~0,8 sichtbar kleiner, lesbar gleich gut. */
const JPEG_QUALITY = 0.8;

export type PreparedImage = {
  /** Base64 **ohne** `data:`-Präfix – so verlangt es die Claude API. */
  base64: string;
  mediaType: "image/jpeg";
};

/**
 * Verkleinert das Bild auf `MAX_EDGE` und gibt es als Base64-JPEG zurück.
 * Ein bereits kleineres Bild wird nicht vergrößert, aber trotzdem neu
 * codiert – sonst blieben die EXIF-Daten erhalten (Grund 3 oben).
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Das Bild ließ sich im Browser nicht verkleinern.");
    context.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (!base64) throw new Error("Das Bild ließ sich im Browser nicht verkleinern.");

    return { base64, mediaType: "image/jpeg" };
  } finally {
    // Gibt den Speicher des dekodierten Bildes frei, statt auf die
    // Garbage Collection zu warten – bei mehreren Fotos hintereinander auf
    // einem Telefon ist das der Unterschied zwischen flüssig und zäh.
    bitmap.close();
  }
}
