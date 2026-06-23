import { TabView } from "./TabView";

// Next.js 15: route params are async.
export default async function TabPage({
  params,
}: {
  params: Promise<{ tableCode: string }>;
}) {
  const { tableCode } = await params;
  return <TabView tableCode={tableCode} />;
}
