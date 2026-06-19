"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabs } from "@/components/layout/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ApiError } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { PinCard, PinRequirementsCard } from "@/components/settings/cards";

// Security tab: the manager override PIN + which actions require it.
export default function SecuritySettingsPage() {
  const { query, update } = useStoreSettings();

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="text-3xl font-black text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Manager override PIN &amp; PIN-required actions</p>
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
          <PinCard configured={query.data.pinConfigured} onSaved={() => query.refetch()} />
          <PinRequirementsCard
            pinConfigured={query.data.pinConfigured}
            overrides={query.data.overridePinRequired}
            discounts={query.data.discountPinRequired}
            voids={query.data.voidPinRequired}
            saving={update.isPending}
            onToggle={(patch) => update.mutate(patch)}
          />
        </div>
      ) : null}
    </AdminShell>
  );
}
