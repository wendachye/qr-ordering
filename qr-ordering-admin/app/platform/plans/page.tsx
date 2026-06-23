"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { platformPlansApi } from "@/lib/endpoints";
import { PlanCard } from "@/components/platform/PlanCard";

export default function PlatformPlansPage() {
  const { user, status } = useAuth();
  const plansQuery = useQuery({
    queryKey: ["platform-plans"],
    queryFn: platformPlansApi.list,
    enabled: !!user?.isPlatformAdmin,
  });

  if (status === "loading") {
    return (
      <>
        <LoadingState label="Loading…" />
      </>
    );
  }

  if (!user?.isPlatformAdmin) {
    return (
      <>
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold text-slate-900">Restricted</h1>
            <p className="mt-1 text-slate-500">
              The Plans console is for the platform operator only.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>

      {plansQuery.isLoading ? (
        <LoadingState label="Loading plans…" />
      ) : plansQuery.isError ? (
        <ErrorState message="Could not load plans." onRetry={() => plansQuery.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(plansQuery.data ?? []).map((p) => (
            <PlanCard key={p.key} plan={p} />
          ))}
        </div>
      )}
    </>
  );
}
