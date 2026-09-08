/**
 * Client-sichere Hälfte des Kind-Umschalters: nur die Konstante, kein
 * Server-Code. Getrennt aus demselben Grund wie beim Dev-Umschalter
 * (`dev-actor-shared.ts`): ein Wert-Import aus einer Datei mit
 * `next/headers` zöge das Server-Modul ins Client-Bundle.
 */

export const STUDENT_SWITCH_COOKIE = "tutr_parent_student";
