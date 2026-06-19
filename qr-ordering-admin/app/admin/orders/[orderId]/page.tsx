"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import {
  OrderStatusBadge,
  PrintStatusBadge,
} from "@/components/orders/OrderStatusBadge";
import { OrderActions } from "@/components/orders/OrderActions";
import { OrderItemList } from "@/components/orders/OrderItemList";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ordersApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatPrice } from "@/lib/format";
import type { PrintJob } from "@/lib/types";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);

  const query = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(orderId),
  });

  return (
    <AdminShell>
      <div className="mb-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading order…" />
      ) : query.isError ? (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Could not load this order."
          }
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        (() => {
          const order = query.data;
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main column */}
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardContent>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h1 className="text-3xl font-black text-slate-900">
                          Order #{order.orderNumber}
                        </h1>
                        <p className="mt-1 text-lg font-semibold text-slate-700">
                          {order.tableName}{" "}
                          <span className="text-slate-400">
                            ({order.tableCode})
                          </span>
                        </p>
                        <p className="mt-1 text-slate-500">
                          Placed {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h2 className="mb-2 text-xl font-bold text-slate-900">
                      Items
                    </h2>
                    <OrderItemList items={order.items} />

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between text-base text-slate-600">
                        <span>Subtotal</span>
                        <span>{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xl font-bold text-slate-900">
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {order.note && (
                  <Card>
                    <CardContent>
                      <h2 className="mb-1 text-xl font-bold text-slate-900">
                        Order note
                      </h2>
                      <p className="text-base italic text-amber-700">
                        {order.note}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Side column */}
              <div className="space-y-6">
                <Card>
                  <CardContent>
                    <h2 className="mb-3 text-xl font-bold text-slate-900">
                      Actions
                    </h2>
                    <div className="flex flex-col gap-3">
                      <OrderActions
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        status={order.status}
                        variant="detail"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <h2 className="mb-3 text-xl font-bold text-slate-900">
                      Print jobs
                    </h2>
                    {order.printJobs.length === 0 ? (
                      <p className="text-slate-500">No print jobs yet.</p>
                    ) : (
                      <ul className="space-y-3">
                        {order.printJobs.map((job) => (
                          <PrintJobRow key={job.id} job={job} />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()
      ) : null}
    </AdminShell>
  );
}

function PrintJobRow({ job }: { job: PrintJob }) {
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <PrintStatusBadge status={job.status} />
        {job.retryCount > 0 && (
          <span className="text-sm text-slate-400">
            {job.retryCount} {job.retryCount === 1 ? "retry" : "retries"}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Created {formatDateTime(job.createdAt)}
      </p>
      {job.printedAt && (
        <p className="text-sm text-slate-500">
          Printed {formatDateTime(job.printedAt)}
        </p>
      )}
      {job.error && (
        <p className="mt-1 text-sm font-medium text-red-600">{job.error}</p>
      )}
    </li>
  );
}
