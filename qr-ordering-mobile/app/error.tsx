"use client";

import { useEffect } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { ErrorState } from "@/components/common/ErrorState";

// App-level error boundary for the diner app. An unexpected render throw in any
// page lands here and renders INSIDE MobileShell — so a crash stays on-brand and
// recoverable instead of falling through to Next's default error page.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for the console / any error reporter.
    console.error(error);
  }, [error]);

  return (
    <MobileShell>
      <ErrorState
        title="Something went wrong"
        message="An unexpected error occurred on this page. Please try again."
        onRetry={reset}
      />
    </MobileShell>
  );
}
