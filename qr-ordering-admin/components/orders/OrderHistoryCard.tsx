"use client";

import { Printer, RotateCcw, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  OrderStatusBadge,
  PrintStatusBadge,
} from "@/components/orders/OrderStatusBadge";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { TableOrder } from "@/lib/types";

export function OrderHistoryCard({
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
