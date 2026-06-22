"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { OrderHistoryCard } from "@/components/orders/OrderHistoryCard";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { ordersApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";

// A table's flat order history — reached from a floor tile's ⋯ menu with
// ?tableId&table. Lists every order placed at the table, newest first.
export default function TableHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [table] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("tableId");
    return id ? { id, name: p.get("table") ?? "Table" } : null;
  });

  const query = useQuery({
    queryKey: ["table-orders", table?.id],
    queryFn: () => ordersApi.byTable(table!.id),
    enabled: !!table,
    refetchInterval: 8000,
  });

  const reprint = useMutation({
    mutationFn: (orderId: string) => ordersApi.reprint(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-orders", table?.id] });
      toast("Kitchen ticket reprint queued.", "success");
    },
    onError: (err) =>
      toast(err instanceof ApiError ? err.message : "Reprint failed.", "error"),
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

      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">
          {table ? `${table.name} · Order history` : "Order history"}
        </h1>
        <p className="mt-1 text-slate-500">
          {table
            ? "Every order placed at this table, newest first"
            : "Open a table to see its orders"}
          {query.isFetching && !query.isLoading && " · updating…"}
        </p>
      </div>

      {!table ? (
        <EmptyState
          title="Pick a table"
          description="Open a table's ⋯ menu and choose History."
        />
      ) : query.isLoading ? (
        <LoadingState label="Loading order history…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Could not load order history."
          }
          onRetry={() => query.refetch()}
        />
      ) : query.data && query.data.length > 0 ? (
        <div className="space-y-4">
          {query.data.map((order) => (
            <OrderHistoryCard
              key={order.id}
              order={order}
              onReprint={() => reprint.mutate(order.id)}
              reprinting={reprint.isPending}
              onOrderAgain={
                order.sessionId
                  ? () =>
                      router.push(
                        `/admin/orders/new?table=${encodeURIComponent(order.tableCode)}&from=${order.sessionId}&order=${order.id}`
                      )
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No orders yet"
          description={`${table.name} hasn't had any orders yet.`}
        />
      )}
    </>
  );
}
