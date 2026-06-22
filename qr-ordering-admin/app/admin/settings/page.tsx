"use client";

import { Store } from "lucide-react";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { ApiError } from "@/lib/api";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { InlineText } from "@/components/settings/InlineText";
import { PaymentMethodsCard } from "@/components/settings/PaymentMethodsCard";

// General settings: store identity + payment methods. Charges/tax live under the
// Charges tab; the override PIN + PIN-required actions live under Security.
export default function GeneralSettingsPage() {
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
    </>
  );
}
