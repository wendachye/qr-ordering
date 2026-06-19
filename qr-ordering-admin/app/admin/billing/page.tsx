"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { billingApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { Billing } from "@/lib/types";

function statusLabel(b: { status: string; plan: string | null; trialDaysLeft: number | null }) {
  switch (b.status) {
    case "TRIALING":
      return `Trial — ${b.trialDaysLeft ?? 0} day${b.trialDaysLeft === 1 ? "" : "s"} left`;
    case "ACTIVE":
      return `Active${b.plan ? ` · ${b.plan}` : ""}`;
    case "PAST_DUE":
      return "Payment past due";
    default:
      return "Canceled";
  }
}

// Friendly labels for the feature keys stored on each plan.
const FEATURE_LABELS: Record<string, string> = {
  loyalty: "Loyalty program",
  vouchers: "Vouchers & promo codes",
  reports_advanced: "Advanced analytics & reports",
  tax_multi: "Multiple taxes (SST / GST)",
};
const featureLabel = (k: string) =>
  FEATURE_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Bullet lines for a plan card: the table/menu limits, then unlocked features.
function planLines(p: Billing["plans"][number]): string[] {
  return [
    p.maxTables == null ? "Unlimited tables" : `Up to ${p.maxTables} tables`,
    p.maxMenuItems == null ? "Unlimited menu items" : `Up to ${p.maxMenuItems} menu items`,
    ...p.features.map(featureLabel),
  ];
}

export default function BillingPage() {
  const { toast } = useToast();
  const query = useQuery({ queryKey: ["billing"], queryFn: billingApi.get });

  const redirect = (res: { url: string | null }) => {
    if (res.url) window.location.assign(res.url);
    else toast("Billing is not configured in this environment.", "error");
  };
  const onError = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : "Something went wrong.", "error");

  const checkout = useMutation({ mutationFn: (plan: string) => billingApi.checkout(plan), onSuccess: redirect, onError });
  const portal = useMutation({ mutationFn: () => billingApi.portal(), onSuccess: redirect, onError });

  // Direct activation when Stripe isn't configured (dev / self-hosted / manual billing).
  const qc = useQueryClient();
  const apply = useMutation({
    mutationFn: (plan: string) => billingApi.apply(plan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast("Plan applied.", "success");
    },
    onError,
  });

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Manage your subscription and plan.</p>
      </div>
      <SettingsTabs />

      {query.isLoading ? (
        <LoadingState label="Loading billing…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load billing."}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Current status</p>
                  <p className="text-xl font-bold text-slate-900">{statusLabel(query.data)}</p>
                  {!query.data.active && (
                    <p className="mt-1 text-sm font-medium text-red-700">
                      Subscription inactive — subscribe to keep using the dashboard.
                    </p>
                  )}
                </div>
                {(query.data.status === "ACTIVE" || query.data.status === "PAST_DUE") && (
                  <Button onClick={() => portal.mutate()} disabled={portal.isPending}>
                    Manage billing
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {query.data.plans.map((p) => {
              const isCurrent = query.data!.plan === p.key && query.data!.status === "ACTIVE";
              // Highest-tier plan (last by sortOrder) gets the "Most popular" badge.
              const isTopTier =
                p.key === query.data!.plans[query.data!.plans.length - 1]?.key;
              return (
                <Card
                  key={p.key}
                  className={isCurrent ? "border-accent-500 ring-1 ring-accent-500" : ""}
                >
                  <CardContent>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-slate-900">{p.name}</p>
                      {isCurrent ? (
                        <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                          Current plan
                        </span>
                      ) : isTopTier ? (
                        <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                          Most popular
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {p.monthlyPrice > 0 ? (
                        <>
                          {p.currency} {p.monthlyPrice}
                          <span className="text-sm font-medium text-slate-400"> /mo</span>
                        </>
                      ) : (
                        "Free"
                      )}
                    </p>

                    {p.description && (
                      <p className="mt-2 text-sm text-slate-500">{p.description}</p>
                    )}

                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {planLines(p).map((line) => (
                        <li key={line} className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-accent-600" />
                          {line}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5">
                      {query.data!.billingEnabled ? (
                        <Button
                          className="w-full"
                          variant={isCurrent ? "secondary" : undefined}
                          disabled={isCurrent || checkout.isPending}
                          onClick={() => checkout.mutate(p.key)}
                        >
                          {isCurrent
                            ? "Current plan"
                            : query.data!.status === "ACTIVE"
                              ? "Switch to this plan"
                              : "Subscribe"}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={isCurrent ? "secondary" : undefined}
                          disabled={isCurrent || apply.isPending}
                          onClick={() => apply.mutate(p.key)}
                        >
                          {isCurrent ? "Current plan" : "Apply plan"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
