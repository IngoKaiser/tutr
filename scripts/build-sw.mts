/**
 * Baut public/sw.js aus src/sw.ts (F-09a, ADR 0015).
 *
 * Läuft als `postbuild`, nie davor: Das Vorcache-Manifest zeigt auf
 * `.next/static`, das erst nach `next build` existiert. Zwei Schritte:
 * `tsc` kompiliert `sw.ts` (keine npm-Importe darin, also kein Bundler
 * nötig – siehe ADR 0015 Nachtrag), danach injiziert `@serwist/build` das
 * Vorcache-Manifest in die kompilierte Datei und schreibt sie nach
 * `public/sw.js`.
 */
import { injectManifest } from "@serwist/build";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextStaticDir = path.join(projectRoot, ".next", "static");
const buildIdFile = path.join(projectRoot, ".next", "BUILD_ID");

if (!existsSync(nextStaticDir) || !existsSync(buildIdFile)) {
  throw new Error(
    "Kein .next/static gefunden – build-sw.mts muss nach `next build` laufen (postbuild), nicht davor.",
  );
}

const buildId = readFileSync(buildIdFile, "utf8").trim();

// tsc statt eines Bundlers – sw.ts hat keine npm-Importe (ADR 0015 Nachtrag).
const tmpDir = mkdtempSync(path.join(tmpdir(), "tutr-sw-"));
try {
  execFileSync("tsc", ["--project", "tsconfig.sw.json", "--outDir", tmpDir], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  const compiledPath = path.join(tmpDir, "sw.js");
  // Ein Cache je Build (siehe Kommentar in sw.ts) – ohne diese Ersetzung
  // fände `activate` nie einen alten Cache zum Aufräumen.
  const compiled = readFileSync(compiledPath, "utf8");
  writeFileSync(compiledPath, compiled.replaceAll("__BUILD_ID__", buildId));

  const { count, size, warnings } = await injectManifest({
    swSrc: compiledPath,
    swDest: path.join(projectRoot, "public", "sw.js"),
    globDirectory: nextStaticDir,
    // Bewusst schmal (CLAUDE.md: „Offline nur für Karten-/Vokabel-Sessions"),
    // keine automatische Alles-Precache-Liste wie bei `@serwist/next`.
    globPatterns: ["chunks/**/*.js", "chunks/**/*.css", "*.css"],
    modifyURLPrefix: { "": "/_next/static/" },
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  });

  for (const warning of warnings) console.warn(warning);
  console.log(
    `Service Worker gebaut: ${count} Dateien, ${(size / 1024).toFixed(0)} KB vorgecacht.`,
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
