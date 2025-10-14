"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FlyerZoneBuilder from "@/components/editor/FlyerZoneBuilder";
import type { FlyerLayout } from "@/lib/types";
import { loadFlyerLayout } from "@/lib/storage/flyers";
import { Button } from "@/components/ui/button";
import Loader from "@/components/Loader";

type ExistingLayoutState = {
  id: string;
  name: string;
  flyerBlob: Blob;
  width: number;
  height: number;
  fileName: string;
  zones: FlyerLayout["zones"];
  createdAt: string;
  placements?: FlyerLayout["placements"];
};

export default function ZonePage({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<FlyerLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await loadFlyerLayout(id);
        if (!stored) {
          throw new Error("Flyer introuvable");
        }
        if (!cancelled) {
          setLayout(stored);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError);
          setError(
            loadError instanceof Error ? loadError.message : "Erreur inconnue"
          );
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
  }, [id]);

  const existingLayout = useMemo<ExistingLayoutState | null>(() => {
    if (!layout) return null;
    return {
      id: layout.meta.id,
      name: layout.meta.name,
      flyerBlob: layout.flyerBlob,
      width: layout.meta.width,
      height: layout.meta.height,
      fileName: layout.meta.fileName,
      zones: layout.zones,
      createdAt: layout.meta.createdAt,
      placements: layout.placements,
    };
  }, [layout]);

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="flex h-full w-full items-center justify-center py-20">
        <Loader />
      </div>
    );
  } else if (error) {
    content = (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-20 text-center">
        <p className="text-base font-medium text-destructive">{error}</p>
        <Button onClick={() => router.push("/")}>
          Retour à l&apos;accueil
        </Button>
      </div>
    );
  } else if (existingLayout) {
    content = <FlyerZoneBuilder existingLayout={existingLayout} />;
  } else {
    content = (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-20 text-center">
        <p className="text-base font-medium text-muted-foreground">
          Impossible de charger ce flyer.
        </p>
        <Button onClick={() => router.push("/")}>
          Retour à l&apos;accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {content}
    </div>
  );
}
