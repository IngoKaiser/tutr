import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";

import { loadSchoolYearDetail, loadSchoolYearHistory } from "../actions";

export const metadata = { title: "Meine Schuljahre · tutr" };

const EINSTELLUNGEN = { href: "/einstellungen", label: "Einstellungen" };

const STATUS_LABEL: Record<"geplant" | "aktiv" | "archiviert", string> = {
  geplant: "geplant",
  aktiv: "aktiv",
  archiviert: "archiviert",
};

/**
 * „Meine Schuljahre" (F-16b, §9) – read-only. Konzept §9 sagt das
 * ausdrücklich: Wer wissen will, welche Fächer in einem vergangenen Jahr
 * liefen, soll das nachschlagen können, ohne etwas daran ändern zu können.
 * Schreiben (ein neues Jahr eröffnen) passiert ausschließlich unter
 * „Einstellungen" – diese Seite lädt nur.
 */
export default async function SchoolYearHistoryPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const years = await loadSchoolYearHistory();
  if (!years) redirect("/einstellungen");

  const details = await Promise.all(years.map((year) => loadSchoolYearDetail(year.id)));

  return (
    <>
      <PageHeader title="Meine Schuljahre" back={EINSTELLUNGEN} />
      <div className="flex flex-col gap-3">
        {years.map((year, i) => {
          const detail = details[i];
          return (
            <Block
              key={year.id}
              title={year.label}
              trailing={`Jahrgang ${year.gradeLevel}${year.className ? ` · ${year.className}` : ""} · ${STATUS_LABEL[year.status]}`}
            >
              {!detail || (detail.subjects.length === 0 && detail.vocabSets.length === 0) ? (
                <Notice>Keine Fächer zugeordnet.</Notice>
              ) : (
                <div className="flex flex-col gap-2 text-[0.8125rem]">
                  {detail.subjects.length > 0 ? (
                    <p className="text-tinte">
                      <span className="text-tinte-leise">Fächer: </span>
                      {detail.subjects.map((s) => s.name).join(", ")}
                    </p>
                  ) : null}
                  {detail.vocabSets.length > 0 ? (
                    <p className="text-tinte">
                      <span className="text-tinte-leise">Vokabelsets: </span>
                      {detail.vocabSets.map((s) => s.title).join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </Block>
          );
        })}
      </div>
    </>
  );
}
