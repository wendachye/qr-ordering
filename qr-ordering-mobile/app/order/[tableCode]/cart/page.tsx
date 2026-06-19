import { CartView } from "./CartView";

export default async function CartPage({
  params,
}: {
  params: Promise<{ tableCode: string }>;
}) {
  const { tableCode } = await params;
  return <CartView tableCode={tableCode} />;
}
