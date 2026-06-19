"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/common/Toast";

type SettingsUpdate = {
  storeName?: string;
  takeawayCharge?: number;
  serviceChargeRate?: number;
  taxes?: { name: string; rate: number }[];
  voidPinRequired?: boolean;
  discountPinRequired?: boolean;
  overridePinRequired?: boolean;
  paymentMethods?: string[];
};

// Shared store-settings data + save mutation for the settings tabs (General /
// Charges / Security). Keeps the ["settings"] cache and the menu-page cache in
// sync, and surfaces API errors through the toast.
export function useStoreSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const update = useMutation({
    mutationFn: (input: SettingsUpdate) => settingsApi.update(input),
    onSuccess: (s) => {
      queryClient.setQueryData(["settings"], s);
      queryClient.invalidateQueries({ queryKey: ["menu-settings"] });
      toast("Settings saved.", "success");
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Could not save settings.", "error"),
  });

  return { query, update };
}
