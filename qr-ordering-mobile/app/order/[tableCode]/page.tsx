import { MenuView } from "./MenuView";

// Next.js 15: route params are async.
export default async function MenuPage({
  params,
}: {
  params: Promise<{ tableCode: string }>;
}) {
  const { tableCode } = await params;
  return <MenuView tableCode={tableCode} />;
}
