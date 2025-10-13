import { ThemeToggler } from "@/components/ThemeToggler";
import FlyerZoneBuilder from "@/components/editor/FlyerZoneBuilder";

export default function NewLayoutPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <FlyerZoneBuilder />
    </div>
  );
}
