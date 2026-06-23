"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/common/LoadingState";

// Root: send to orders if authed, otherwise to login.
export default function HomePage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") router.replace("/admin/tables");
    else if (status === "unauthenticated") router.replace("/admin/login");
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="Loading…" />
    </div>
  );
}
