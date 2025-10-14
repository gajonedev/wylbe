import PublicFlyerPlacementEditor from "@/components/editor/PublicFlyerPlacementEditor";
import React from "react";

export default async function ViewLayoutPage({
  params,
}: {
  params: Promise<{ layoutId: string }>;
}) {
  const { layoutId } = await params;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <PublicFlyerPlacementEditor layoutId={layoutId} />
    </div>
  );
}
