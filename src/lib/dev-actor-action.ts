"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { devActorEnabled } from "./dev-actor";
import { DEV_ACTOR_COOKIE, type DevRole } from "./dev-actor-shared";

/**
 * Setzt die Dev-Rolle. Server Action statt `document.cookie`, weil das Setzen
 * eines Cookies eine Mutation ist (CLAUDE.md) – und weil die Prüfung auf
 * `devActorEnabled()` dann serverseitig passiert und nicht umgangen werden kann.
 */
export async function setDevRole(rolle: DevRole): Promise<void> {
  if (!devActorEnabled()) return;

  const store = await cookies();
  store.set(DEV_ACTOR_COOKIE, rolle, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
