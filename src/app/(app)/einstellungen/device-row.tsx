"use client";

import { useTransition } from "react";

import { removeCredential, revokeStudentSession } from "./actions";

const ACTIONS = { removeCredential, revokeSession: revokeStudentSession } as const;

/** Eine Zeile in der Passkey- oder Geräteliste, mit der jeweils passenden Aktion. */
export function DeviceRow({
  id,
  label,
  timestampLabel,
  timestamp,
  action,
  actionLabel,
}: {
  id: string;
  label: string;
  timestampLabel: string;
  timestamp: string | null;
  action: keyof typeof ACTIONS;
  actionLabel: string;
}) {
  const [pending, startAction] = useTransition();

  return (
    <li className="border-linie flex items-center justify-between gap-3 rounded-[9px] border px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-tinte truncate text-[0.8125rem] font-medium">{label}</span>
        <span className="text-tinte-leise text-[0.75rem]">
          {timestampLabel}: {timestamp ? new Date(timestamp).toLocaleDateString("de-DE") : "nie"}
        </span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startAction(() => ACTIONS[action](id))}
        className="border-linie-stark bg-flaeche text-tinte-weich hover:text-tinte focus-visible:outline-koenigsblau shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </li>
  );
}
