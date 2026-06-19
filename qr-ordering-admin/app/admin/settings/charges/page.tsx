"use client";

import { ShoppingBag } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ApiError } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useEntitlements } from "@/hooks/useEntitlements";
import { InlineNumber, ServiceTaxCard } from "@/components/settings/cards";

// Charges tab: takeaway charge + service charge & tax (tax_multi gated).
export default function ChargesSettingsPage() {
  const { query, update } = useStoreSettings();
  const { locked } = useEntitlements();
  const taxMultiLocked = locked("tax_multi");

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Charges, service charge &amp; tax</p>
      </div>
      <SettingsTabs />

      {query.isLoading ? (
        <LoadingState label="Loading settings…" />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load settings."}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <div className="mx-auto max-w-2xl space-y-4">
          <InlineNumber
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Takeaway charge"
            subtitle="Added per takeaway item — staff can waive it on each order."
            value={query.data.takeawayCharge}
            saving={update.isPending}
            onSave={(v) => update.mutate({ takeawayCharge: v })}
          />
          <ServiceTaxCard
            serviceChargeRate={query.data.serviceChargeRate}
            taxes={query.data.taxes}
            locked={taxMultiLocked}
            saving={update.isPending}
            onSave={(v) => update.mutate(v)}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}
