import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/common/Button";

export default function HomePage() {
  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl text-accent-fg">
          🍽️
        </div>
        <div>
          <h1 className="text-2xl font-bold text-black">QR Ordering</h1>
          <p className="mt-2 text-sm text-gray-600">
            Scan the QR code on your table to view the menu and order.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <Link href="/order/TBL001">
            <Button size="lg" className="w-full">
              Try the demo (Table 1)
            </Button>
          </Link>
          <p className="mt-3 text-xs text-gray-400">
            Demo table code: TBL001
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
