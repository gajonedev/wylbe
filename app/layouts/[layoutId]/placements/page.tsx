import { ThemeToggler } from "@/components/ThemeToggler";
import FlyerPlacementEditor from "@/components/editor/FlyerPlacementEditor";

type PlacementPageProps = {
  params: {
    layoutId: string;
  };
};

export default function PlacementPage({ params }: PlacementPageProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <FlyerPlacementEditor layoutId={params.layoutId} />
      <div className="fixed bottom-5 right-6">
        <ThemeToggler />
      </div>
    </div>
  );
}
