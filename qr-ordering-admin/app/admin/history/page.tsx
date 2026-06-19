"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, RotateCcw, ShoppingBag } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  OrderStatusBadge,
  PrintStatusBadge,
} from "@/components/orders/OrderStatusBadge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { useToast } from "@/components/common/Toast";
import { ordersApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { TableOrder } from "@/lib/types";

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
    <AdminShell>
      <div className="mb-4">
        <Link
          href="/admin/floor"
          className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Floor
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">
          {table ? `${table.name} · Order history` : "Order history"}
        </h1>
        <p className="mt-1 text-slate-500">
          {table
            ? "Every order placed at this table, newest first"
            : "Open a table from the Floor to see its orders"}
          {query.isFetching && !query.isLoading && " · updating…"}
        </p>
      </div>

      {!table ? (
        <EmptyState
          title="Pick a table"
          description="Open a table's ⋯ menu on the Floor and choose History."
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
    </AdminShell>
  );
}

function OrderHistoryCard({
  order,
  onReprint,
  reprinting,
  onOrderAgain,
}: {
  order: TableOrder;
  onReprint: () => void;
  reprinting: boolean;
  onOrderAgain?: () => void;
}) {
  const cancelled = order.status === "CANCELLED";
  return (
    <Card className={cn(cancelled && "opacity-60")}>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-slate-900">
              #{order.orderNumber}
            </span>
            <span className="text-sm text-slate-400">
              {formatDateTime(order.createdAt)}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2">
            <PrintStatusBadge status={order.printStatus} />
            <Button
              variant="secondary"
              size="sm"
              onClick={onReprint}
              disabled={reprinting}
            >
              <Printer />
              Reprint
            </Button>
            {onOrderAgain && (
              <Button size="sm" onClick={onOrderAgain}>
                <RotateCcw />
                Order again
              </Button>
            )}
          </div>
        </div>

        <ul className="mt-3 divide-y divide-slate-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start gap-4 py-2">
              <span className="flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-accent-50 px-2 text-sm font-bold text-accent-700">
                {item.quantity}×
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {item.name}
                  {item.isTakeaway && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      <ShoppingBag className="h-3 w-3" />
                      Takeaway
                    </span>
                  )}
                  {item.priceOverridden && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Price override
                    </span>
                  )}
                </p>
                {item.selectedOptions.length > 0 && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {item.selectedOptions
                      .map((o) => `${o.group}: ${o.choice}`)
                      .join(" · ")}
                  </p>
                )}
                {item.note && (
                  <p className="mt-0.5 text-sm italic text-amber-700">
                    Remarks: {item.note}
                  </p>
                )}
              </div>
              <span className="font-semibold text-slate-700">
                {formatPrice(item.totalPrice)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-sm text-slate-500">
            {order.totalItems} {order.totalItems === 1 ? "item" : "items"}
          </span>
          <span className="text-lg font-bold text-slate-900">
            {formatPrice(order.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
