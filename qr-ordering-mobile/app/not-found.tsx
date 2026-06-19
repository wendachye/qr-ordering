import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/common/Button";

export default function NotFound() {
  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
          🤔
        </div>
        <div>
          <h1 className="text-xl font-bold text-black">Page not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This page doesn&apos;t exist. Scan your table QR code to start
            ordering.
          </p>
        </div>
        <Link href="/" className="w-full max-w-xs">
          <Button size="lg" className="w-full">
            Go home
          </Button>
        </Link>
      </div>
    </MobileShell>
  );
}
