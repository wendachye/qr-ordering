"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { trashApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";

// Compact "deleted N ago" for the row subtitle.
function deletedWhen(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Settings → Trash: soft-deleted catalog/config records, newest first, each with
// a one-click Restore. Codes stay reserved while deleted, so a restore can't clash.
export function TrashManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({ queryKey: ["trash"], queryFn: trashApi.list });

  const restore = useMutation({
    mutationFn: ({ resource, id }: { resource: string; id: string }) =>
      trashApi.restore(resource, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash"] });
      toast("Restored.", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not restore.", "error"),
  });

  if (query.isLoading) return <LoadingState label="Loading trash…" />;
  if (query.isError)
    return (
      <ErrorState
        message={query.error instanceof ApiError ? query.error.message : "Could not load trash."}
        onRetry={() => query.refetch()}
      />
    );

  const entries = query.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-slate-500">
        Deleted menu items, categories, set meals, tables, vouchers, rewards and members are kept
        here and can be restored. Their codes stay reserved while deleted, so a restore never
        clashes with a live record.
      </p>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Trash2 className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Trash is empty</p>
            <p className="text-xs text-slate-400">Deleted records show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={`${e.resource}:${e.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone="gray">{e.label}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{e.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      Deleted {deletedWhen(e.deletedAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate({ resource: e.resource, id: e.id })}
                >
                  <RotateCcw />
                  Restore
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
