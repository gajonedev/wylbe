import ZonePage from "@/components/ZonePage";

export default async function Page({
  params,
}: {
  params: Promise<{ layoutId: string }>;
}) {
  const { layoutId } = await params;

  return <ZonePage id={layoutId} />;
}
