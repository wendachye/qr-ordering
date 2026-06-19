import Link from "next/link";
import { Button } from "./Button";

export function EmptyState({
  title,
  message,
  actionHref,
  actionLabel,
  icon = "🍽️",
}: {
  title: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-black">{title}</h2>
        {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref}>
          <Button variant="primary">{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}
