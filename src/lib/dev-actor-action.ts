"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { umschalterVerfuegbar } from "./dev-actor";
import { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

/**
 * Setzt die gewählte Ansicht. Server Action statt `document.cookie`, weil das
 * Setzen eines Cookies eine Mutation ist (CLAUDE.md) – und weil die Prüfung
 * serverseitig passiert und nicht umgangen werden kann.
 *
 * Wechselt nur die *Sicht* eines angemeldeten Elternteils. Eine Anmeldung
 * ersetzt sie nicht: Ohne Session kommt man gar nicht erst hierher.
 */
export async function setDevRole(rolle: DevRole): Promise<void> {
  if (!umschalterVerfuegbar()) return;

  const store = await cookies();
  store.set(DEV_ACTOR_COOKIE, rolle, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
