"use client";

import { Badge } from "@/components/ui/badge";
import type { AuditEntry } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionTone(action: string): "green" | "amber" | "gray" {
  if (action === "outlet.impersonate") return "amber";
  if (action.endsWith(".create")) return "green";
  return "gray";
}

export function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmt(entry.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-slate-800">{entry.actorEmail}</span>
        {entry.actorImp && <span className="block text-xs text-amber-600">via {entry.actorImp}</span>}
      </td>
      <td className="px-4 py-3">
        <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {entry.summary ?? `${entry.entity}${entry.entityId ? ` · ${entry.entityId}` : ""}`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
        {entry.ip ?? "—"}
      </td>
    </tr>
  );
}
