"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { platformClientsApi } from "@/lib/endpoints";
import { ClientRow } from "@/components/platform/ClientRow";

export default function ClientsPage() {
  const q = useQuery({ queryKey: ["platform-clients"], queryFn: platformClientsApi.list });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link href="/platform/clients/new">
          <Button>
            <Plus />
            New client
          </Button>
        </Link>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading clients…" />
      ) : q.isError ? (
        <ErrorState message="Could not load clients." onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            No clients yet — create your first restaurant account.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {q.data!.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </div>
      )}
    </>
  );
}
