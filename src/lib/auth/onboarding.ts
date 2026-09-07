import { sql } from "drizzle-orm";

import { withActor, withAuthUser, type Actor } from "@/db/actor";
import { SEED_IDS } from "@/db/seed-ids";

/**
 * Vom bestätigten Supabase-Login zum Actor (F-05).
 *
 * Beim ersten Login gibt es noch kein Elternkonto, also wird hier das Nötigste
 * angelegt: eine Familie und ein `parent_user`.
 *
 * Nach ADR 0005 ist das künftig der Sonderfall. Im Normalfall entsteht die
 * Familie durch das Kind (F-06), und ein Elternteil tritt ihr später bei
 * (F-06b) – dieser Weg hier legt dann keine neue Familie mehr an.
 */

/** Ergebnis eines Logins: der Actor, plus ob dabei etwas angelegt wurde. */
export type LoginErgebnis = {
  actor: Actor;
  neuAngelegt: boolean;
};

/**
 * Sucht das Elternkonto zur Auth-ID. Läuft über `withAuthUser`, weil die
 * Familie an dieser Stelle noch unbekannt ist.
 */
async function findeElternkonto(
  authUserId: string,
): Promise<{ id: string; family_id: string } | null> {
  const zeilen = await withAuthUser(authUserId, (tx) =>
    tx.execute<{ id: string; family_id: string }>(
      sql`select id, family_id from parent_user where auth_user_id = ${authUserId} limit 1`,
    ),
  );
  return zeilen[0] ?? null;
}

/**
 * In der Entwicklung an die Seed-Familie andocken statt eine zweite Welt
 * aufzumachen: Der Dev-Umschalter zeigt auf Familie A, ein frischer Login
 * würde sonst eine parallele Familie anlegen, in der nichts steht.
 *
 * In Produktion gibt es diesen Zweig nicht.
 */
async function versucheSeedFamilie(authUserId: string, name: string): Promise<Actor | null> {
  if (process.env.NODE_ENV === "production") return null;

  const actor: Actor = {
    role: "parent",
    familyId: SEED_IDS.familieA,
    userId: SEED_IDS.elternteilA,
  };

  const zeilen = await withActor(actor, (tx) =>
    tx.execute<{ id: string }>(
      sql`select id from parent_user where id = ${SEED_IDS.elternteilA} limit 1`,
    ),
  );
  if (zeilen.length === 0) return null;

  // Die Seed-Zeile auf die echte Auth-ID umschreiben, damit der nächste Login
  // sie regulär findet und dieser Sonderweg nur einmal greift.
  await withActor(actor, (tx) =>
    tx.execute(
      sql`update parent_user set auth_user_id = ${authUserId}, name = ${name}
          where id = ${SEED_IDS.elternteilA}`,
    ),
  );
  return actor;
}

/** Legt Familie und Elternkonto an – im Actor-Kontext, nicht an RLS vorbei. */
async function legeFamilieAn(authUserId: string, name: string): Promise<Actor> {
  const familyId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // Der Actor zeigt auf die Familie, die gleich entsteht. Die Policies prüfen
  // `id = app.family_id()` bzw. `family_id = app.family_id()` – beides trifft zu.
  const actor: Actor = { role: "parent", familyId, userId };

  await withActor(actor, async (tx) => {
    await tx.execute(sql`insert into family (id, name) values (${familyId}, ${name})`);
    await tx.execute(
      sql`insert into parent_user (id, family_id, auth_user_id, name)
          values (${userId}, ${familyId}, ${authUserId}, ${name})`,
    );
  });

  return actor;
}

/**
 * Der Einstiegspunkt nach einem bestätigten Login.
 * `name` dient nur als Anzeigename; er kommt aus dem lokalen Teil der E-Mail.
 */
export async function actorFuerAuthUser(authUserId: string, email: string): Promise<LoginErgebnis> {
  const vorhanden = await findeElternkonto(authUserId);
  if (vorhanden) {
    return {
      actor: { role: "parent", familyId: vorhanden.family_id, userId: vorhanden.id },
      neuAngelegt: false,
    };
  }

  const name = email.split("@")[0] || "Elternteil";

  const ausSeed = await versucheSeedFamilie(authUserId, name);
  if (ausSeed) return { actor: ausSeed, neuAngelegt: false };

  return { actor: await legeFamilieAn(authUserId, name), neuAngelegt: true };
}
