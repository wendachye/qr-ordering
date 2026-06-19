"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { billingApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";

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

          {!query.data.billingEnabled && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Billing isn&apos;t configured in this environment — set the Stripe keys to enable checkout.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {query.data.plans.map((p) => (
              <Card key={p.key}>
                <CardContent>
                  <p className="text-lg font-bold text-slate-900">{p.name}</p>
                  <Button
                    className="mt-3 w-full"
                    disabled={!query.data!.billingEnabled || checkout.isPending}
                    onClick={() => checkout.mutate(p.key)}
                  >
                    {query.data!.status === "ACTIVE" ? "Switch to this plan" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
