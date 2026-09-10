"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";

import {
  createSet,
  deleteSet,
  type OrphanGroup,
  type SubjectOption,
  type VocabSetSummary,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Sets nach Fach, mit Anlegen und Löschen (V-03a; „Ohne Set" seit V-03d).
 *
 * Löschen ist zweistufig, kein Eintippen – wie „Elternkonto löschen" in
 * F-06e: Es gehen keine Vokabeln verloren, nur die Set-Zuordnung. Seit V-03d
 * fragt das Löschen zusätzlich, ob Vokabeln, die dadurch in **keinem** Set
 * mehr stecken, mitgelöscht werden sollen – sonst wären sie nur noch über
 * „Ohne Set" erreichbar.
 */
export function SetList({
  sets,
  subjects,
  orphanGroups,
  canManage,
}: {
  sets: VocabSetSummary[] | null;
  subjects: SubjectOption[] | null;
  orphanGroups: OrphanGroup[] | null;
  canManage: boolean;
}) {
  const grouped = new Map<string, VocabSetSummary[]>();
  for (const set of sets ?? []) {
    const list = grouped.get(set.subjectName) ?? [];
    list.push(set);
    grouped.set(set.subjectName, list);
  }

  const orphansBySubject = new Map<string, OrphanGroup>();
  for (const group of orphanGroups ?? []) orphansBySubject.set(group.subjectName, group);

  // Fächer mit Waisen-Vokabeln, aber ohne Set, hätten sonst keinen Block –
  // dann käme man an die Waisen nicht heran.
  const subjectNames = new Set<string>([...grouped.keys(), ...orphansBySubject.keys()]);
  const sorted = [...subjectNames].sort((a, b) => a.localeCompare(b, "de"));

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Vokabeln" back={{ href: "/faecher", label: "Fächer" }} />

      {canManage ? <CreateSetForm subjects={subjects} /> : null}

      {sets === null ? (
        <Notice>Zahlen sind gerade nicht verfügbar.</Notice>
      ) : sorted.length === 0 ? (
        <Notice>Noch keine Sets angelegt.</Notice>
      ) : (
        sorted.map((subjectName) => {
          const orphans = orphansBySubject.get(subjectName);
          return (
            <Block key={subjectName} title={subjectName}>
              <ul className="flex flex-col gap-2">
                {(grouped.get(subjectName) ?? []).map((set) => (
                  <SetRow key={set.id} set={set} canManage={canManage} />
                ))}
                {orphans ? (
                  <li>
                    <Link
                      href={`/faecher/vokabeln/ohne-set/${orphans.subjectId}`}
                      className="border-linie bg-papier hover:bg-papier-tief flex items-center justify-between gap-3 rounded-[9px] border border-dashed px-3 py-2.5"
                    >
                      <span className="text-tinte-weich text-[0.8125rem] font-medium">
                        Ohne Set
                      </span>
                      <span className="text-tinte-leise text-[0.75rem]">
                        {orphans.count} {orphans.count === 1 ? "Vokabel" : "Vokabeln"}
                      </span>
                    </Link>
                  </li>
                ) : null}
              </ul>
            </Block>
          );
        })
      )}
    </div>
  );
}

const MINI_BUTTON =
  "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";

function SetRow({ set, canManage }: { set: VocabSetSummary; canManage: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function del(alsoDeleteOrphans: boolean) {
    startTransition(() => deleteSet(set.id, alsoDeleteOrphans));
  }

  return (
    <li className="border-linie flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/faecher/vokabeln/${set.id}`} className="min-w-0 flex-1">
          <span className="text-tinte block truncate text-[0.8125rem] font-medium">
            {set.title}
          </span>
          <span className="text-tinte-leise text-[0.75rem]">
            {set.itemCount} {set.itemCount === 1 ? "Vokabel" : "Vokabeln"}
          </span>
        </Link>

        {canManage && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-tinte-leise hover:text-tinte-weich shrink-0 px-2 py-1 text-xs font-medium"
          >
            Löschen
          </button>
        ) : null}
      </div>

      {confirming ? (
        <div className="flex flex-col gap-1.5">
          {set.wouldOrphan > 0 ? (
            <>
              <p className="text-tinte-weich text-xs leading-normal">
                {set.wouldOrphan} {set.wouldOrphan === 1 ? "Vokabel steckt" : "Vokabeln stecken"} in
                keinem anderen Set. Mitlöschen oder behalten?
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => del(false)}
                  className={MINI_BUTTON}
                >
                  {pending ? "…" : "Nur das Set"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => del(true)}
                  className={MINI_BUTTON}
                >
                  {pending
                    ? "…"
                    : `Set und ${set.wouldOrphan} ${set.wouldOrphan === 1 ? "Vokabel" : "Vokabeln"}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="text-tinte-leise hover:text-tinte-weich px-2 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => del(false)}
                className={MINI_BUTTON}
              >
                {pending ? "…" : "Ja, löschen"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="text-tinte-leise hover:text-tinte-weich px-2 py-1 text-xs font-medium disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function CreateSetForm({ subjects }: { subjects: SubjectOption[] | null }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects?.[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  if (!subjects || subjects.length === 0) return null;

  if (!open) {
    return (
      <Button quiet onClick={() => setOpen(true)}>
        Neues Set anlegen
      </Button>
    );
  }

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createSet({ subjectId, title: title.trim() });
      setTitle("");
      setOpen(false);
    });
  }

  return (
    <Block title="Neues Set">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2.5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Fach</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={FIELD}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Unité 3 oder Klassenarbeit 2"
            autoFocus
            className={FIELD}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Einen Moment …" : "Anlegen"}
          </Button>
          <Button quiet type="button" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Block>
  );
}
