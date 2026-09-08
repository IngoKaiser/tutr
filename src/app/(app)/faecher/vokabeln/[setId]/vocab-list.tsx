"use client";

import { useState, useTransition } from "react";

import { Block, Button, Notice, PageHeader } from "@/components/shell/primitives";

import {
  addFromPaste,
  addManualItem,
  deleteItem,
  updateItem,
  type SetDetail,
  type VocabRow,
} from "./actions";

const FIELD =
  "border-linie-stark bg-flaeche text-tinte placeholder:text-tinte-leise focus-visible:outline-koenigsblau rounded-[9px] border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

/**
 * Die Vokabelliste eines Sets (V-03a, ADR 0007 D2).
 *
 * Keine Tabelle, kein eigener Review-Screen: eine vertikale Liste, unsichere
 * Zeilen oben (schon so sortiert von `loadSetDetail()`), Antippen klappt zum
 * Bearbeiten auf. Dieselbe Ansicht dient dem Import-Tag wie der Korrektur
 * drei Wochen später – ein Denkmodell.
 */
export function VocabList({ detail, canManage }: { detail: SetDetail; canManage: boolean }) {
  const unsichereAnzahl = detail.items.filter((item) => item.unsicher).length;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={detail.title}
        trailing={detail.subjectName}
        back={{ href: "/faecher/vokabeln", label: "Vokabelsets" }}
      />

      {unsichereAnzahl > 0 ? (
        <Notice>
          {unsichereAnzahl === 1
            ? "1 Zeile solltest du prüfen."
            : `${unsichereAnzahl} Zeilen solltest du prüfen.`}
        </Notice>
      ) : null}

      {canManage ? <AddArea setId={detail.id} /> : null}

      {detail.items.length === 0 ? (
        <Notice>Noch keine Vokabeln in diesem Set.</Notice>
      ) : (
        <Block>
          <ul className="flex flex-col gap-2">
            {detail.items.map((item) => (
              <VocabRowItem key={item.id} setId={detail.id} item={item} canManage={canManage} />
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function AddArea({ setId }: { setId: string }) {
  const [mode, setMode] = useState<"geschlossen" | "einfuegen" | "manuell">("geschlossen");
  const [pasteText, setPasteText] = useState("");
  const [manualTerm, setManualTerm] = useState("");
  const [manualTranslation, setManualTranslation] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitPaste() {
    if (!pasteText.trim()) return;
    startTransition(async () => {
      const result = await addFromPaste(setId, pasteText);
      setPasteText("");
      setMode("geschlossen");
      setSummary(result ? summarize(result) : null);
    });
  }

  function submitManual() {
    if (!manualTerm.trim()) return;
    startTransition(async () => {
      await addManualItem(setId, manualTerm, manualTranslation);
      setManualTerm("");
      setManualTranslation("");
    });
  }

  if (mode === "geschlossen") {
    return (
      <div className="flex gap-2">
        <Button onClick={() => setMode("einfuegen")}>Einfügen</Button>
        <Button quiet onClick={() => setMode("manuell")}>
          Von Hand
        </Button>
        {summary ? <Notice>{summary}</Notice> : null}
      </div>
    );
  }

  if (mode === "einfuegen") {
    return (
      <Block title="Vokabeln einfügen">
        <Notice>
          Aus Excel, Google Sheets oder einer getippten Liste – eine Vokabel je Zeile, Wort und
          Übersetzung getrennt durch Tab, Semikolon, Komma oder einen Gedankenstrich.
        </Notice>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          autoFocus
          rows={8}
          placeholder={"aller\tgehen\nvenir\tkommen"}
          className={`${FIELD} font-mono`}
        />
        <div className="flex gap-2">
          <Button onClick={submitPaste} disabled={pending || !pasteText.trim()}>
            {pending ? "Einen Moment …" : "Übernehmen"}
          </Button>
          <Button quiet onClick={() => setMode("geschlossen")} disabled={pending}>
            Abbrechen
          </Button>
        </div>
      </Block>
    );
  }

  return (
    <Block title="Vokabel von Hand">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitManual();
        }}
        className="flex flex-col gap-2.5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Wort</span>
          <input
            value={manualTerm}
            onChange={(e) => setManualTerm(e.target.value)}
            autoFocus
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8125rem] font-medium">Übersetzung</span>
          <input
            value={manualTranslation}
            onChange={(e) => setManualTranslation(e.target.value)}
            className={FIELD}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !manualTerm.trim()}>
            {pending ? "Einen Moment …" : "Hinzufügen"}
          </Button>
          <Button quiet type="button" onClick={() => setMode("geschlossen")} disabled={pending}>
            Fertig
          </Button>
        </div>
      </form>
    </Block>
  );
}

function summarize(result: { neu: number; verknuepft: number; zuPruefen: number }): string {
  const teile: string[] = [];
  if (result.neu > 0) teile.push(`${result.neu} neu`);
  if (result.verknuepft > 0) teile.push(`${result.verknuepft} schon vorhanden, nur verknüpft`);
  if (result.zuPruefen > 0) teile.push(`${result.zuPruefen} zu prüfen`);
  return teile.length > 0 ? teile.join(", ") + "." : "Nichts übernommen.";
}

function VocabRowItem({
  setId,
  item,
  canManage,
}: {
  setId: string;
  item: VocabRow;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(item.term);
  const [translation, setTranslation] = useState(item.translation);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <li>
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
      </li>
    );
  }

  function save() {
    startTransition(async () => {
      await updateItem(setId, item.id, term, translation);
      setOpen(false);
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteItem(setId, item.id);
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
        <Button quiet onClick={() => setOpen(false)} disabled={pending}>
          Abbrechen
        </Button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="text-tinte-leise hover:text-offen ml-auto text-xs font-medium disabled:opacity-50"
        >
          Das ist keine Vokabel – löschen
        </button>
      </div>
    </li>
  );
}
