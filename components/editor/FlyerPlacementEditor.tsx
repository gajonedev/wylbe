"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Save } from "lucide-react";
import { useDropzone } from "react-dropzone";

import FlyerStage from "@/components/editor/canvas/FlyerStage";
import { useFlyerEditorState } from "@/components/editor/hooks/useFlyerEditorState";
import { Button } from "@/components/ui/button";
import {
  dataUrlToBlob,
  fileToDataUrl,
  loadImageDimensions,
} from "@/lib/images";
import type { FlyerLayout } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deleteFlyerLayout,
  loadFlyerLayout,
  saveFlyerLayout,
} from "@/lib/storage/flyers";

interface FlyerPlacementEditorProps {
  layoutId: string;
}

export function FlyerPlacementEditor({ layoutId }: FlyerPlacementEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutMeta, setLayoutMeta] = useState<FlyerLayout["meta"] | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const flyerBlobRef = useRef<Blob | null>(null);
  const flyerUrlRef = useRef<string | null>(null);
  const placementDataRef = useRef<Map<string, string>>(new Map());
  const placementUrlsRef = useRef<Map<string, string>>(new Map());

  const editorState = useFlyerEditorState(null, [], [], {
    allowDrawing: false,
    allowPlacements: true,
  });

  const {
    flyer,
    zones,
    placements,
    showGuides,
    isExporting,
    selectedZoneId,
    setShowGuides,
    setIsExporting,
    setFlyer,
    setZones,
    setPlacements,
    computeInitialPlacement,
    setSelectedZoneId,
    stageRef,
    stageScaleRef,
    handleSelectZone,
  } = editorState;

  // console.log("Flyer: ", flyer);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const layout = await loadFlyerLayout(layoutId);
        // console.log("Loaded layout", layout);

        if (!layout) {
          throw new Error("Flyer introuvable");
        }
        if (cancelled) return;

        flyerBlobRef.current = layout.flyerBlob;
        setLayoutMeta(layout.meta);

        const flyerUrl = URL.createObjectURL(layout.flyerBlob);
        flyerUrlRef.current = flyerUrl;
        setFlyer({
          url: flyerUrl,
          width: layout.meta.width,
          height: layout.meta.height,
          fileName: layout.meta.fileName,
        });
        setZones(layout.zones);

        placementDataRef.current.clear();
        placementUrlsRef.current.forEach((value) => URL.revokeObjectURL(value));
        placementUrlsRef.current.clear();

        const normalizedPlacements: Record<
          string,
          (typeof placements)[string]
        > = {};
        if (layout.placements && layout.placements.length > 0) {
          layout.placements.forEach((placement) => {
            let resolvedUrl = placement.url;
            if (placement.url.startsWith("data:")) {
              placementDataRef.current.set(placement.zoneId, placement.url);
              const blob = dataUrlToBlob(placement.url);
              const objectUrl = URL.createObjectURL(blob);
              placementUrlsRef.current.set(placement.zoneId, objectUrl);
              resolvedUrl = objectUrl;
            }
            normalizedPlacements[placement.zoneId] = {
              ...placement,
              url: resolvedUrl,
            };
          });
        }
        setPlacements(() => normalizedPlacements);
        setSelectedZoneId(layout.zones.at(0)?.id ?? null);
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
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
  }, [layoutId, setFlyer, setPlacements, setSelectedZoneId, setZones]);

  useEffect(() => {
    const placementUrls = placementUrlsRef.current;
    return () => {
      const flyerUrl = flyerUrlRef.current;
      if (flyerUrl) {
        URL.revokeObjectURL(flyerUrl);
        flyerUrlRef.current = null;
      }
      placementUrls.forEach((value) => URL.revokeObjectURL(value));
      placementUrls.clear();
    };
  }, []);

  const handleZoneImageChange = useCallback(
    async (accepted: File[]) => {
      if (!selectedZoneId) return;
      const zone = zones.find((item) => item.id === selectedZoneId);
      if (!zone) return;

      const file = accepted.at(0);
      if (!file) return;

      const url = URL.createObjectURL(file);
      const { width, height } = await loadImageDimensions(url);
      const dataUrl = await fileToDataUrl(file);

      const initial = computeInitialPlacement(
        zone,
        width,
        height,
        url,
        file.name
      );

      setPlacements((prev) => ({
        ...prev,
        [selectedZoneId]: initial,
      }));

      placementDataRef.current.set(selectedZoneId, dataUrl);
      const previousUrl = placementUrlsRef.current.get(selectedZoneId);
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      placementUrlsRef.current.set(selectedZoneId, url);
    },
    [computeInitialPlacement, selectedZoneId, setPlacements, zones]
  );

  const zoneDropzone = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    noClick: false,
    disabled: !selectedZoneId,
    onDrop: handleZoneImageChange,
  });

  const handleRemovePlacement = useCallback(() => {
    if (!selectedZoneId) return;
    setPlacements((prev) => {
      if (!prev[selectedZoneId]) return prev;
      const next = { ...prev };
      delete next[selectedZoneId];
      return next;
    });
    const previousUrl = placementUrlsRef.current.get(selectedZoneId);
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      placementUrlsRef.current.delete(selectedZoneId);
    }
    placementDataRef.current.delete(selectedZoneId);
  }, [selectedZoneId, setPlacements]);

  const handleResetPlacement = useCallback(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((item) => item.id === selectedZoneId);
    const placement = placements[selectedZoneId];
    if (!zone || !placement) return;

    const resetPlacement = computeInitialPlacement(
      zone,
      placement.imageWidth,
      placement.imageHeight,
      placement.url,
      placement.fileName
    );

    setPlacements((prev) => ({
      ...prev,
      [selectedZoneId]: {
        ...placement,
        position: resetPlacement.position,
        scale: resetPlacement.scale,
        rotation: 0,
      },
    }));
  }, [
    computeInitialPlacement,
    placements,
    selectedZoneId,
    setPlacements,
    zones,
  ]);

  const handleExport = useCallback(async () => {
    console.log("Exporting...", { flyer, stageRef });

    if (!flyer || !stageRef.current) return;

    setIsExporting(true);
    const stage = stageRef.current;
    const previousGuides = showGuides;

    try {
      if (previousGuides) {
        setShowGuides(false);
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      const pixelRatio = Math.max(1 / (stageScaleRef.current || 1), 1);
      const dataUrl = stage.toDataURL({ mimeType: "image/png", pixelRatio });
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const baseName = layoutMeta?.name?.replace(/\.[^/.]+$/, "") ?? "flyer";
      link.download = `${baseName}-${timestamp}.png`;
      link.href = dataUrl;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (exportError) {
      console.error("Erreur lors de l'export du flyer", exportError);
    } finally {
      setShowGuides(previousGuides);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      setIsExporting(false);
    }
  }, [
    flyer,
    layoutMeta?.name,
    setIsExporting,
    setShowGuides,
    showGuides,
    stageRef,
    stageScaleRef,
  ]);

  const handleSavePlacements = useCallback(async () => {
    if (!layoutMeta || !flyerBlobRef.current) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const placementArray = Object.values(placements).map((placement) => {
        const storedData = placementDataRef.current.get(placement.zoneId);
        const storedUrl = storedData ?? placement.url;
        return {
          ...placement,
          url: storedUrl,
        };
      });

      await saveFlyerLayout({
        meta: {
          ...layoutMeta,
          updatedAt: now,
        },
        flyerBlob: flyerBlobRef.current,
        zones,
        placements: placementArray,
      });
      setLayoutMeta((prev) => (prev ? { ...prev, updatedAt: now } : prev));
    } catch (saveError) {
      console.error(
        "Erreur lors de l'enregistrement des placements",
        saveError
      );
    } finally {
      setIsSaving(false);
    }
  }, [layoutMeta, placements, zones]);

  const handleDeleteLayout = useCallback(async () => {
    if (!layoutMeta) return;
    await deleteFlyerLayout(layoutMeta.id);
    router.push("/");
  }, [layoutMeta, router]);

  const helperMessage = useMemo(() => {
    if (!flyer) return "Importez un flyer pour commencer.";
    if (selectedZoneId) {
      return "Déposez une image pour la zone sélectionnée ou ajustez-la sur le canevas.";
    }
    if (zones.length === 0) {
      return "Aucune zone disponible. Créez d'abord une disposition.";
    }
    return "Sélectionnez une zone pour y associer une image.";
  }, [flyer, selectedZoneId, zones.length]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Chargement du flyer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-base font-medium text-destructive">{error}</p>
        <Button onClick={() => router.push("/")}>
          Retour à l&apos;accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Placements
          </p>
          <h1 className="text-2xl font-semibold">{layoutMeta?.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {layoutMeta && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/layouts/${layoutMeta.id}/zones`}>
                Modifier les zones
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!flyer || isExporting}
          >
            <Download className="mr-2 size-4" />
            {isExporting ? "Export en cours…" : "Exporter en PNG"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDeleteLayout}>
            Supprimer le flyer
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grow">
                <h2 className="text-lg font-semibold">Canevas</h2>
                <p className="text-sm text-muted-foreground">{helperMessage}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!flyer}
                  onClick={() => setShowGuides((prev) => !prev)}
                >
                  {showGuides ? "Masquer les repères" : "Afficher les repères"}
                </Button>
              </div>
            </div>

            <FlyerStage
              state={editorState}
              className="mt-4"
              allowPlacements={true}
            />
          </section>
        </div>

        <aside className="w-full max-w-md space-y-6">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Zones disponibles</h2>
                <p className="text-sm text-muted-foreground">
                  {zones.length}
                  {zones.length > 1 ? " zones" : " zone"}
                </p>
              </div>
            </header>
            <div className="mt-4 space-y-3">
              {zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun contour. Retournez à l&apos;étape de création pour en
                  ajouter.
                </p>
              ) : (
                zones.map((zone) => {
                  const isSelected = selectedZoneId === zone.id;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => handleSelectZone(zone.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{zone.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {zone.points.length} point
                          {zone.points.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {placements[zone.id]?.fileName ||
                          "Aucune image assignée"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Insertion photo</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedZoneId
                    ? "Déposez une image pour l'associer à la zone."
                    : "Sélectionnez une zone pour importer une image."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedZoneId}
                onClick={zoneDropzone.open}
              >
                Importer
              </Button>
            </div>
            <div
              {...zoneDropzone.getRootProps({
                className: cn(
                  "mt-4 flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-center transition-colors",
                  zoneDropzone.isDragActive
                    ? "border-primary bg-primary/10"
                    : selectedZoneId
                      ? "bg-muted/30"
                      : "bg-muted/40 opacity-60"
                ),
              })}
            >
              <input {...zoneDropzone.getInputProps()} />
              {selectedZoneId ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {zoneDropzone.isDragActive
                      ? "Relâchez pour associer"
                      : "Déposez une image ici"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formats : PNG, JPG. Ajustez ensuite directement dans le
                    canevas.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choisissez une zone avant d&apos;ajouter une image.
                </p>
              )}
            </div>
            {selectedZoneId && placements[selectedZoneId] && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium">Image assignée</p>
                <p className="text-muted-foreground">
                  {placements[selectedZoneId]?.fileName ?? "Sans nom"}
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPlacement}
                  >
                    Réinitialiser
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePlacement}
                  >
                    Supprimer l&apos;image
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <Button
              className="w-full"
              onClick={handleSavePlacements}
              disabled={isSaving}
            >
              <Save className="mr-2 size-4" />
              {isSaving ? "Enregistrement…" : "Enregistrer les placements"}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default FlyerPlacementEditor;
