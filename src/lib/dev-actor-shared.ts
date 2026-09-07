/**
 * Client-sichere Hälfte des Dev-Actors: nur Konstanten und Typen, keine
 * Server-APIs. Getrennt von `dev-actor.ts`, weil ein Wert-Import aus einer
 * Datei mit `next/headers` das Server-Modul ins Client-Bundle zöge.
 */

export const DEV_ACTOR_COOKIE = "tutr_dev_actor";

export type DevRole = "parent" | "student";
