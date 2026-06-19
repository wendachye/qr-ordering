"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/endpoints";

// Thin strip across the top: trial countdown, past-due notice, or an inactive
// wall nudge. Hidden entirely for healthy ACTIVE subscriptions.
export function BillingBanner() {
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: billingApi.get,
    staleTime: 60_000,
  });
  if (!data || data.status === "ACTIVE") return null;

  const inactive = !data.active;
  let message: string | null = null;
  if (inactive) message = "Your subscription is inactive.";
  else if (data.status === "TRIALING")
    message = `Trial: ${data.trialDaysLeft} day${data.trialDaysLeft === 1 ? "" : "s"} left.`;
  else if (data.status === "PAST_DUE") message = "Payment past due — please update your billing.";
  if (!message) return null;

  return (
    <div
      className={`px-4 py-2 text-center text-sm font-medium print:hidden ${
        inactive ? "bg-red-600 text-white" : "bg-amber-50 text-amber-800"
      }`}
    >
      {message}{" "}
      <Link href="/admin/billing" className="font-semibold underline">
        {inactive ? "Subscribe now" : "Manage billing"}
      </Link>
    </div>
  );
}
