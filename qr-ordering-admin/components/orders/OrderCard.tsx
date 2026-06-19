"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { OrderStatusBadge, PrintStatusBadge } from "./OrderStatusBadge";
import { OrderActions } from "./OrderActions";
import { formatRelative, formatTime } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";

export function OrderCard({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const open = () => router.push(`/admin/orders/${order.id}`);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        // Only the card itself (not the action buttons) triggers navigation.
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          open();
        }
      }}
      className="flex cursor-pointer flex-col transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardContent className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-black text-slate-900">
              #{order.orderNumber}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-slate-700">
              {order.tableName}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-slate-600">
          <span>
            <span className="font-semibold text-slate-900">
              {order.totalItems}
            </span>{" "}
            {order.totalItems === 1 ? "item" : "items"}
          </span>
          <span title={formatTime(order.createdAt)}>
            {formatRelative(order.createdAt)}
          </span>
        </div>

        {order.printStatus && (
          <div className="mt-3">
            <PrintStatusBadge status={order.printStatus} />
          </div>
        )}
      </CardContent>

      {/* Action buttons — clicks here must not bubble up to the card navigation.
          flex-nowrap keeps Complete/Cancel/Reprint on a single row. */}
      <CardFooter className="flex-nowrap" onClick={(e) => e.stopPropagation()}>
        <OrderActions
          orderId={order.id}
          orderNumber={order.orderNumber}
          status={order.status}
          variant="card"
        />
      </CardFooter>
    </Card>
  );
}
