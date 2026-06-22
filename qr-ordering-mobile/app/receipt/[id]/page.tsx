import { ReceiptView } from "./ReceiptView";

// Next.js 15: route params are async. The diner-facing receipt for a settled tab.
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceiptView id={id} />;
}
