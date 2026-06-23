"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { platformClientsApi } from "@/lib/endpoints";
import { ClientDetail } from "@/components/platform/ClientDetail";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({
    queryKey: ["platform-client", id],
    queryFn: () => platformClientsApi.get(id),
  });
  return (
    <>
      <Link
        href="/platform/clients"
        className="mb-4 inline-flex items-center gap-1 text-base font-semibold text-accent-700 hover:text-accent-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Clients
      </Link>
      {q.isLoading ? (
        <LoadingState label="Loading client…" />
      ) : q.isError ? (
        <ErrorState message="Could not load this client." onRetry={() => q.refetch()} />
      ) : q.data ? (
        <ClientDetail client={q.data} />
      ) : null}
    </>
  );
}
