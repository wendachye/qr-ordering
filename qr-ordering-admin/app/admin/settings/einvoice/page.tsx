"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import { einvoiceApi } from "@/lib/endpoints";
import type { EinvoiceSettingsInput } from "@/lib/types";
import { SellerDetailsCard } from "@/components/einvoice/SellerDetailsCard";
import { InvoicesTable } from "@/components/einvoice/InvoicesTable";

// Settings → e-Invoice: seller details (settings:manage) on one sub-tab and the
// issued-invoices list (reports:view) on the other.
export default function EinvoiceSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({ queryKey: ["einvoice-settings"], queryFn: einvoiceApi.getSettings });

  const update = useMutation({
    mutationFn: (input: EinvoiceSettingsInput) => einvoiceApi.updateSettings(input),
    onSuccess: (s) => {
      qc.setQueryData(["einvoice-settings"], s);
      toast("e-Invoice settings saved.", "success");
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Could not save e-Invoice settings.", "error"),
  });

  return (
    <>
      <SettingsTabs />

      <Tabs defaultValue="seller" className="mx-auto max-w-2xl">
        <TabsList>
          <TabsTrigger value="seller">Seller details</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="seller" className="mt-4">
          {query.isLoading ? (
            <LoadingState label="Loading e-Invoice settings…" />
          ) : query.isError ? (
            <ErrorState
              message={
                query.error instanceof ApiError ? query.error.message : "Could not load settings."
              }
              onRetry={() => query.refetch()}
            />
          ) : query.data ? (
            <SellerDetailsCard
              settings={query.data}
              saving={update.isPending}
              onSave={(input) => update.mutate(input)}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTable />
        </TabsContent>
      </Tabs>
    </>
  );
}
