"use client";

import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ApiError } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { PinCard } from "@/components/settings/PinCard";
import { PinRequirementsCard } from "@/components/settings/PinRequirementsCard";

// Security tab: the manager override PIN + which actions require it.
export default function SecuritySettingsPage() {
  const { query, update } = useStoreSettings();

  return (
    <>
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
    </>
  );
}
