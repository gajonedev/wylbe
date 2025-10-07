"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FlyerLayoutSummary } from "@/lib/types";
import { deleteFlyerLayout, listFlyerLayouts } from "@/lib/storage/flyers";

export function FlyerList() {
  const [layouts, setLayouts] = useState<FlyerLayoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-3 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Vos flyers
          </p>
          <h1 className="text-3xl font-semibold">Bibliothèque</h1>
          <p className="text-sm text-muted-foreground">
            Créez une nouvelle disposition ou reprenez-en une pour placer les
            photos.
          </p>
        </div>
        <Button asChild>
          <Link href="/layouts/new">
            <PlusCircle className="mr-2 size-4" />
            Nouveau flyer
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
          Chargement des flyers enregistrés…
        </div>
      ) : layouts.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
          Aucun flyer sauvegardé pour le moment. Créez-en un nouveau pour
          commencer.
        </div>
      ) : (
        <div className="grid gap-4">
          {layouts.map((layout) => (
            <div
              key={layout.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center"
            >
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{layout.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {layout.fileName} • {layout.width} × {layout.height}px
                </p>
                <p className="text-xs text-muted-foreground">
                  Dernière modification :{" "}
                  {new Date(layout.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/layouts/${layout.id}/zones`}>Zones</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/layouts/${layout.id}/placements`}>
                    Placements
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(layout.id)}
                  title="Supprimer"
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
