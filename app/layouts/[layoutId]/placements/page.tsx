import FlyerPlacementEditor from "@/components/editor/FlyerPlacementEditor";

type PlacementPageProps = {
  params: Promise<{
    layoutId: string;
  }>;
};

export default async function PlacementPage({ params }: PlacementPageProps) {
  const { layoutId } = await params;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <FlyerPlacementEditor layoutId={layoutId} />
    </div>
  );
}
