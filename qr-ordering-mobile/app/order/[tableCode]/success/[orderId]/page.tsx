import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/common/Button";
import { VoucherEntry } from "./VoucherEntry";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableCode: string; orderId: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { tableCode, orderId } = await params;
  const { n } = await searchParams;

  // Use the human-readable order number (passed as ?n=) when available; with no
  // number, show none at all — a raw cuid means nothing to the diner.
  const orderLabel = n ? ` #${n}` : "";

  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-4xl">
          ✅
        </div>

        <div>
          <h1 className="text-2xl font-bold text-black">
            Order{orderLabel} sent to the kitchen
          </h1>
          <p className="mt-3 text-base text-gray-600">
            It&apos;s been added to your table&apos;s tab. Order as many rounds as
            you like — just settle the bill at the end.
          </p>
        </div>

        <VoucherEntry tableCode={tableCode} />

        <Link href={`/order/${encodeURIComponent(tableCode)}`} className="w-full max-w-xs">
          <Button size="lg" className="w-full">
            Order more
          </Button>
        </Link>

        <Link
          href={`/order/${encodeURIComponent(tableCode)}/tab`}
          className="text-sm font-medium text-accent"
        >
          View your tab →
        </Link>
      </div>
    </MobileShell>
  );
}
