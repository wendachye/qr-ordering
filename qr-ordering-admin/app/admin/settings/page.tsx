"use client";

import { Store } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ApiError } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { InlineText, PaymentMethodsCard } from "@/components/settings/cards";

// General settings: store identity + payment methods. Charges/tax live under the
// Charges tab; the override PIN + PIN-required actions live under Security.
export default function GeneralSettingsPage() {
  const { query, update } = useStoreSettings();

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Restaurant details &amp; payment methods</p>
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
          <InlineText
            icon={<Store className="h-5 w-5" />}
            title="Restaurant name"
            subtitle="Shown on receipts and the daily Z reading."
            value={query.data.storeName}
            saving={update.isPending}
            onSave={(v) => update.mutate({ storeName: v })}
          />
          <PaymentMethodsCard
            methods={query.data.paymentMethods}
            saving={update.isPending}
            onSave={(m) => update.mutate({ paymentMethods: m })}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}
