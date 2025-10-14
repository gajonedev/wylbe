"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FlyerLayoutSummary } from "@/lib/types";
import { deleteFlyerLayout, listFlyerLayouts } from "@/lib/storage/flyers";
import Loader from "../Loader";
import { toast } from "sonner";

export function FlyerList() {
  const [layouts, setLayouts] = useState<FlyerLayoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Fetch the list of flyer layouts
    const load = async () => {
      try {
        const items = await listFlyerLayouts();
        if (!cancelled) {
          setLayouts(items);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    await deleteFlyerLayout(id);
    setLayouts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Bibliothèque</h1>
          <p className="text-sm text-muted-foreground">
            Créez un nouveau layout ou reprenez-en un pour placer les photos.
          </p>
        </div>
        <Button asChild>
          <Link href="/layouts/new">
            <PlusCircle className="size-4" />
            Nouveau flyer
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex w-full items-center justify-center pt-8">
          <Loader />
        </div>
      ) : layouts.length === 0 ? (
        <div className="border border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
          Aucun flyer sauvegardé pour le moment. Créez-en un nouveau pour
          commencer.
        </div>
      ) : (
        <div className="grid gap-4">
          {layouts.map((layout) => (
            <div
              key={layout.id}
              className="flex flex-col justify-between gap-4 border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center"
            >
              <div className="space-y-2">
                <h2 className="text-xl font-semibold line-clamp-1">
                  {layout.name}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {layout.fileName} • {layout.width} × {layout.height} px
                </p>
                <p className="text-xs text-muted-foreground">
                  Dernière modification :{" "}
                  {new Date(layout.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/layouts/${layout.id}/zones`}>Modifier</Link>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/view/${layout.id}`
                    );
                    toast.success("Lien copié dans le presse-papiers");
                  }}
                >
                  <Link2 className="size-4 transform -rotate-45" />
                  Lien
                </Button>
                <Button
                  variant="outlineDestructive"
                  size="icon"
                  onClick={() => handleDelete(layout.id)}
                  title="Supprimer"
                  className="size-7.5"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FlyerList;
