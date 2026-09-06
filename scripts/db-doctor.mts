/**
 * Prüft die Datenbank-Konfiguration und benennt, was fehlt – ohne Geheimnisse
 * auszugeben. Die Ausgabe kann bedenkenlos geteilt werden.
 *
 *   node scripts/db-doctor.mts          # .env.local
 *   node scripts/db-doctor.mts --test   # .env.test.local
 *
 * Hintergrund: Laufzeit und Migrationen nutzen verschiedene Rollen
 * (docs/adr/0004-datenmodell-rls.md, D1). Die häufigsten Fehler sind eine
 * Laufzeitverbindung als `postgres`, ein fehlendes sslmode=require und ein
 * Passwort, das nicht zu dem passt, mit dem die Rolle angelegt wurde.
 */
import postgres from "postgres";

const useTest = process.argv.includes("--test");
const envFile = useTest ? ".env.test.local" : ".env.local";

try {
  process.loadEnvFile(envFile);
} catch {
  console.log(`Hinweis: ${envFile} nicht gefunden – es zählt, was in der Umgebung steht.\n`);
}

const runtimeVar = useTest ? "TEST_DATABASE_URL" : "DATABASE_URL";
const migrationVar = useTest ? "TEST_MIGRATION_DATABASE_URL" : "MIGRATION_DATABASE_URL";

const runtime = process.env[runtimeVar] ?? "";
const migration = process.env[migrationVar] ?? "";
const password = process.env.TUTR_APP_DB_PASSWORD ?? "";

let probleme = 0;
const melde = (text: string) => {
  probleme += 1;
  console.log(`   ✗ ${text}`);
};

console.log(`Prüfe ${envFile}\n`);

console.log(`1) ${runtimeVar} (Laufzeit)`);
if (!runtime) {
  melde("fehlt");
} else {
  const url = new URL(runtime);
  const rolle = url.username.split(".")[0];
  console.log(`   Rolle   : ${rolle}`);
  console.log(`   Port    : ${url.port}`);

  // Im Testprojekt wird die tutr_app-Verbindung aus dieser URL abgeleitet
  // (src/db/test-db.ts), dort ist `postgres` richtig.
  if (!useTest && rolle !== "tutr_app") {
    melde(
      `Rolle ist '${rolle}' – die Laufzeit muss als 'tutr_app' verbinden, sonst greift RLS nicht`,
    );
  }
  if (url.searchParams.get("sslmode") !== "require") {
    melde("sslmode=require fehlt – die Verbindung liefe im Klartext");
  }
  if (!useTest) {
    if (url.password === "TUTR_APP_DB_PASSWORD" || url.password.startsWith("<")) {
      melde("der Platzhalter aus .env.example steht noch im String");
    } else if (password && url.password !== password) {
      melde(
        `Passwort weicht von TUTR_APP_DB_PASSWORD ab (${url.password.length} vs. ${password.length} Zeichen) – ` +
          "das Projektpasswort gehört in MIGRATION_DATABASE_URL, nicht hierhin",
      );
    }
  }
}

console.log(`\n2) Rolle tutr_app`);
if (!migration) {
  melde(`${migrationVar} fehlt – kann nicht nachsehen`);
} else {
  const admin = postgres(migration, { prepare: false, max: 1 });
  try {
    const rows = await admin<{ rolcanlogin: boolean; rolbypassrls: boolean }[]>`
      select rolcanlogin, rolbypassrls from pg_roles where rolname = 'tutr_app'`;
    if (rows.length === 0) {
      melde("existiert nicht – 'npm run db:policies' ausführen");
    } else if (rows[0].rolbypassrls) {
      melde("hat BYPASSRLS – Policies wären wirkungslos");
    } else {
      console.log(`   ✓ vorhanden (login=${rows[0].rolcanlogin}, bypassrls=false)`);
    }
  } catch (error) {
    melde(`Verbindung fehlgeschlagen: ${(error as Error).message}`);
  } finally {
    await admin.end();
  }
}

console.log(`\n3) Anmeldung mit ${runtimeVar}`);
if (runtime) {
  const app = postgres(runtime, { prepare: false, max: 1, connect_timeout: 15 });
  try {
    const [row] = await app<{ current_user: string }[]>`select current_user`;
    console.log(`   ✓ verbunden als ${row.current_user}`);
  } catch (error) {
    melde((error as Error).message);
  } finally {
    await app.end();
  }
}

console.log(probleme === 0 ? "\nAlles in Ordnung." : `\n${probleme} Problem(e) gefunden.`);
process.exitCode = probleme === 0 ? 0 : 1;
