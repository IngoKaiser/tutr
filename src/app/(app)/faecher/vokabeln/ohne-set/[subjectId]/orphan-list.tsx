"use client";

import { useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";
import { SwipeRow, UndoLoeschen } from "@/components/shell/swipe-row";
import { useDeferredDelete } from "@/components/shell/use-deferred-delete";
import type { VocabRow } from "@/lib/vocab/review-list";

import {
  assignOrphanToSet,
  confirmOrphan,
  deleteOrphan,
  updateOrphan,
  type OrphanView,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Vokabeln ohne Set (V-03d). Dieselbe Zeilen-Optik wie die Set-Liste, aber
 * mit einem Weg zurück in ein Set – und ohne Import-Bereich, hier wird nur
 * aufgeräumt. „Löschen" entfernt die Vokabel ganz, samt Lernstand.
 */
export function OrphanList({ view, canManage }: { view: OrphanView; canManage: boolean }) {
  const geloescht = useDeferredDelete<VocabRow>((id) => deleteOrphan(view.subjectId, id));
  const sichtbar = view.items.filter((item) => !geloescht.istEntfernt(item.id));

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Ohne Set"
        trailing={view.subjectName}
        back={{ href: "/faecher/vokabeln", label: "Vokabelsets" }}
      />

      <Notice>
        Diese Vokabeln stecken in keinem Set – meist übrig geblieben, nachdem ein Set gelöscht
        wurde. Der Lernstand ist erhalten. Ordne sie einem Set zu oder lösch sie ganz.
      </Notice>

      {view.items.length === 0 ? (
        <Notice>Keine Vokabeln ohne Set. Aufgeräumt.</Notice>
      ) : (
        <Block>
          <ul className="flex flex-col gap-2">
            {sichtbar.map((item) => (
              <OrphanRow
                key={item.id}
                subjectId={view.subjectId}
                item={item}
                sets={view.sets}
                canManage={canManage}
                onDelete={() => geloescht.entfernen(item)}
              />
            ))}
          </ul>
        </Block>
      )}

      <UndoLoeschen
        eintraege={geloescht.pending.map((e) => ({
          id: e.id,
          label: e.term.trim() || "Vokabel",
        }))}
        onZurueck={(id) => geloescht.zuruecknehmen(id)}
      />
    </div>
  );
}

function OrphanRow({
  subjectId,
  item,
  sets,
  canManage,
  onDelete,
}: {
  subjectId: string;
  item: VocabRow;
  sets: { id: string; title: string }[];
  canManage: boolean;
  /** Löschen mit Rückgängig-Fenster (V-11) – vom `useDeferredDelete` der Liste. */
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(item.term);
  const [translation, setTranslation] = useState(item.translation);
  const [setId, setSetId] = useState(sets[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <SwipeRow onDelete={onDelete} disabled={!canManage}>
        <button
          type="button"
          onClick={() => canManage && setOpen(true)}
          disabled={!canManage}
          className={`flex w-full items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5 text-left disabled:cursor-default ${
            item.unsicher
              ? "border-offen bg-offen-hell"
              : "border-linie bg-papier hover:bg-papier-tief"
          }`}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-tinte truncate text-[0.8125rem] font-medium">
              {item.term || "(kein Wort)"}
            </span>
            <span className="text-tinte-leise truncate text-[0.75rem]">
              {item.translation || "(keine Übersetzung)"}
            </span>
          </span>
          {item.unsicher ? (
            <span className="text-offen shrink-0 text-[0.6875rem] font-semibold">prüfen</span>
          ) : null}
        </button>
      </SwipeRow>
    );
  }

  function save() {
    startTransition(async () => {
      await updateOrphan(subjectId, item.id, term, translation);
      setOpen(false);
    });
  }

  /** „Passt so" – siehe `confirmItem()` in der Set-Liste (V-09). */
  function confirm() {
    startTransition(async () => {
      await confirmOrphan(subjectId, item.id);
      setOpen(false);
    });
  }

  function assign() {
    if (!setId) return;
    startTransition(async () => {
      await assignOrphanToSet(subjectId, item.id, setId);
    });
  }

  return (
    <li className="border-koenigsblau bg-koenigsblau-hell flex flex-col gap-2 rounded-[9px] border px-3 py-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Wort</span>
        <input value={term} onChange={(e) => setTerm(e.target.value)} className={FIELD} autoFocus />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-tinte-weich text-[0.75rem]">Übersetzung</span>
        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          className={FIELD}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "…" : "Speichern"}
        </Button>
        {item.unsicher ? (
          <Button quiet onClick={confirm} disabled={pending}>
            {pending ? "…" : "Passt so"}
          </Button>
        ) : null}
        <Button quiet onClick={() => setOpen(false)} disabled={pending}>
          Abbrechen
        </Button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          disabled={pending}
          className="text-tinte-leise hover:text-offen ml-auto text-xs font-medium disabled:opacity-50"
        >
          Löschen
        </button>
      </div>

      {sets.length > 0 ? (
        <div className="border-koenigsblau/30 flex flex-wrap items-center gap-2 border-t pt-2">
          <span className="text-tinte-weich text-[0.75rem]">Einem Set zuordnen:</span>
          <select
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            className={`${FIELD} min-w-0 flex-1`}
          >
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <Button quiet onClick={assign} disabled={pending || !setId}>
            {pending ? "…" : "Zuordnen"}
          </Button>
        </div>
      ) : (
        <p className="text-tinte-leise border-koenigsblau/30 border-t pt-2 text-[0.75rem]">
          Für dieses Fach gibt es noch kein Set. Leg unter „Vokabelsets&ldquo; eins an, dann lässt
          sich diese Vokabel dorthin zuordnen.
        </p>
      )}
    </li>
  );
}
