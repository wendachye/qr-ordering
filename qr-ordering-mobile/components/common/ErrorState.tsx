import Link from "next/link";
import { Button } from "./Button";

export function ErrorState({
  title = "Something went wrong",
  message,
  backHref,
  backLabel = "Back to menu",
  onRetry,
}: {
  title?: string;
  message: string;
  backHref?: string;
  backLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
        ⚠️
      </div>
      <div>
        <h2 className="text-lg font-semibold text-black">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{message}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {backHref && (
          <Link href={backHref}>
            <Button variant="primary">{backLabel}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
