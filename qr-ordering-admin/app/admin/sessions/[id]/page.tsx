"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { sessionsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { TableWorkspace } from "@/components/sessions/TableWorkspace";
import { ClosedSessionView } from "@/components/sessions/ClosedSessionView";

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const query = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsApi.get(id),
    refetchInterval: 5000,
  });

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/tables"
          className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Tables
        </Link>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading table…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Could not load this table."
          }
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        query.data.status === "OPEN" ? (
          <TableWorkspace session={query.data} />
        ) : (
          <ClosedSessionView session={query.data} />
        )
      ) : null}
    </>
  );
}
