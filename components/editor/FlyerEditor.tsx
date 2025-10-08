"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Download, Eye, EyeOff } from "lucide-react";

import FlyerStage from "@/components/editor/canvas/FlyerStage";
import { useFlyerEditorState } from "@/components/editor/hooks/useFlyerEditorState";
import { Button } from "@/components/ui/button";
import { loadImageDimensions } from "@/lib/images";
import { MIN_POINTS } from "@/lib/geometry";
import { cn } from "@/lib/utils";
import type { Zone } from "@/lib/types";

function waitForNextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function FlyerEditor() {
  const storageKeyRef = useRef<string | null>(null);
  const revokeFlyerUrlRef = useRef<string | null>(null);
  const placementUrlsRef = useRef<Map<string, string>>(new Map());

  const editorState = useFlyerEditorState(null, [], [], {});
  const {
    flyer,
    zones,
    placements,
    currentPoints,
    isDrawing,
    isTracing,
    showGuides,
    isExporting,
    selectedZoneId,
    toggleDrawMode,
    cancelDrawing,
    handleSelectZone,
    handleRemoveZone: rawRemoveZone,
    setShowGuides,
    setIsExporting,
    setPlacements,
    setZones,
    setFlyerImage,
    computeInitialPlacement,
    stageWidth,
    stageHeight,
    stageRef,
    stageScaleRef,
    setSelectedZoneId,
  } = editorState;

  const handleFlyerDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted.at(0);
      if (!file) return;

      const url = URL.createObjectURL(file);
      const { width, height } = await loadImageDimensions(url);

      if (revokeFlyerUrlRef.current) {
        URL.revokeObjectURL(revokeFlyerUrlRef.current);
      }

      revokeFlyerUrlRef.current = url;
      const storageKey = `${file.name}_${width}x${height}`;
      storageKeyRef.current = storageKey;

      let restoredZones: Zone[] | null = null;
      const savedZonesRaw = window.localStorage.getItem(storageKey);
      if (savedZonesRaw) {
        try {
          const parsed = JSON.parse(savedZonesRaw) as Zone[];
          if (Array.isArray(parsed)) {
            restoredZones = parsed;
          }
        } catch (error) {
          console.warn("Impossible de restaurer les zones enregistrées", error);
        }
      }

      setFlyerImage({ url, width, height, fileName: file.name });
      if (restoredZones && restoredZones.length > 0) {
        setZones(restoredZones);
      }

      placementUrlsRef.current.forEach((value) => URL.revokeObjectURL(value));
      placementUrlsRef.current.clear();
    },
    [setFlyerImage, setZones]
  );

  const flyerDropzone = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: handleFlyerDrop,
  });

  useEffect(() => {
    if (!storageKeyRef.current) return;
    window.localStorage.setItem(storageKeyRef.current, JSON.stringify(zones));
  }, [zones]);

  const handleZoneImageChange = useCallback(
    async (accepted: File[]) => {
      if (!selectedZoneId) return;
      const zone = zones.find((item) => item.id === selectedZoneId);
      if (!zone) return;
      if (stageWidth <= 0 || stageHeight <= 0) return;

      const file = accepted.at(0);
      if (!file) return;

      const url = URL.createObjectURL(file);
      const { width, height } = await loadImageDimensions(url);

      const placement = computeInitialPlacement(
        zone,
        width,
        height,
        url,
        file.name
      );

      setPlacements((prev) => {
        const previous = prev[selectedZoneId];
        if (previous) {
          const existingUrl = placementUrlsRef.current.get(selectedZoneId);
          if (existingUrl) {
            URL.revokeObjectURL(existingUrl);
            placementUrlsRef.current.delete(selectedZoneId);
          }
        }
        placementUrlsRef.current.set(selectedZoneId, url);
        return { ...prev, [selectedZoneId]: placement };
      });
    },
    [
      computeInitialPlacement,
      selectedZoneId,
      setPlacements,
      stageHeight,
      stageWidth,
      zones,
    ]
  );

  const zoneDropzone = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    noClick: false,
    disabled: !selectedZoneId,
    onDrop: handleZoneImageChange,
  });

  const handleToggleGuides = useCallback(() => {
    setShowGuides((prev) => !prev);
  }, [setShowGuides]);

  const handleRemoveZone = useCallback(
    (zoneId: string) => {
      const url = placementUrlsRef.current.get(zoneId);
      if (url) {
        URL.revokeObjectURL(url);
        placementUrlsRef.current.delete(zoneId);
      }
      rawRemoveZone(zoneId);
    },
    [rawRemoveZone]
  );

  const handleRemovePlacement = useCallback(() => {
    if (!selectedZoneId) return;
    setPlacements((prev) => {
      if (!prev[selectedZoneId]) return prev;
      const next = { ...prev };
      delete next[selectedZoneId];
      const existingUrl = placementUrlsRef.current.get(selectedZoneId);
      if (existingUrl) {
        URL.revokeObjectURL(existingUrl);
        placementUrlsRef.current.delete(selectedZoneId);
      }
      return next;
    });
  }, [selectedZoneId, setPlacements]);

  const handleResetPlacement = useCallback(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((item) => item.id === selectedZoneId);
    const placement = zone ? placements[selectedZoneId] : undefined;
    if (!zone || !placement) return;

    const initial = computeInitialPlacement(
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
        position: initial.position,
        scale: initial.scale,
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
    if (!flyer || !stageRef.current || stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    setIsExporting(true);
    const stage = stageRef.current;
    const previousGuides = showGuides;

    try {
      if (previousGuides) {
        setShowGuides(false);
      }

      await waitForNextFrame();

      const pixelRatio = Math.max(1 / (stageScaleRef.current || 1), 1);
      const dataUrl = stage.toDataURL({
        mimeType: "image/png",
        pixelRatio,
      });

      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const baseName = flyer.fileName.replace(/\.[^/.]+$/, "");
      link.download = `${baseName || "flyer"}-${timestamp}.png`;
      link.href = dataUrl;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erreur lors de l'export du flyer:", error);
    } finally {
      setShowGuides(previousGuides);
      await waitForNextFrame();
      setIsExporting(false);
    }
  }, [
    flyer,
    setIsExporting,
    setShowGuides,
    showGuides,
    stageHeight,
    stageRef,
    stageScaleRef,
    stageWidth,
  ]);

  useEffect(() => {
    const placementUrlMap = placementUrlsRef.current;
    return () => {
      if (revokeFlyerUrlRef.current) {
        URL.revokeObjectURL(revokeFlyerUrlRef.current);
      }
      placementUrlMap.forEach((value) => URL.revokeObjectURL(value));
      placementUrlMap.clear();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isDrawing) {
        cancelDrawing();
        return;
      }
      setSelectedZoneId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelDrawing, isDrawing, setSelectedZoneId]);

  const selectedPlacement = selectedZoneId
    ? placements[selectedZoneId]
    : undefined;

  const helperMessage = useMemo(() => {
    if (!flyer) return "Ajoutez un flyer pour commencer.";
    if (isDrawing) {
      if (isTracing) {
        return "Relâchez le clic pour fermer la zone librement dessinée.";
      }
      if (currentPoints.length === 0) {
        return "Cliquez puis faites glisser pour dessiner le contour de la zone.";
      }
      if (currentPoints.length < MIN_POINTS) {
        return "Tracez une zone fermée avec au moins trois points distincts.";
      }
      return "Dessinez une forme fermée d'un seul geste pour enregistrer la zone.";
    }
    if (zones.length === 0) {
      return "Aucune zone définie. Lancez le mode dessin pour délimiter un emplacement.";
    }
    if (selectedZoneId) {
      return "Chargez une photo pour la zone sélectionnée ou ajustez-la sur le canevas.";
    }
    return "Sélectionnez une zone pour la modifier ou en créer une nouvelle.";
  }, [
    currentPoints.length,
    flyer,
    isDrawing,
    isTracing,
    selectedZoneId,
    zones.length,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Flyer</h2>
                <p className="text-sm text-muted-foreground">
                  Glissez-déposez un flyer ou cliquez pour en sélectionner un.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={flyerDropzone.open}>
                Importer
              </Button>
            </div>
            <div
              {...flyerDropzone.getRootProps({
                className: cn(
                  "mt-4 flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 text-center transition-colors",
                  flyerDropzone.isDragActive
                    ? "border-primary bg-primary/10"
                    : "bg-muted/30"
                ),
              })}
            >
              <input {...flyerDropzone.getInputProps()} />
              {flyer ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{flyer.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {flyer.width} × {flyer.height}px
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Déposez un nouveau fichier pour remplacer.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {flyerDropzone.isDragActive
                      ? "Relâchez pour importer"
                      : "Déposez votre flyer ici"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formats supportés : PNG, JPG, SVG
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grow">
                <h2 className="text-lg font-semibold">Canevas</h2>
                <p className="text-sm text-muted-foreground">{helperMessage}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  variant={isDrawing ? "secondary" : "default"}
                  size="sm"
                  disabled={!flyer}
                  onClick={toggleDrawMode}
                >
                  {isDrawing ? "Terminer" : "Définir une zone"}
                </Button>
                {isDrawing && (
                  <Button variant="outline" size="sm" onClick={cancelDrawing}>
                    Annuler
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!flyer}
                  onClick={handleToggleGuides}
                >
                  {showGuides ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">
                    {showGuides
                      ? "Masquer les repères"
                      : "Afficher les repères"}
                  </span>
                  <span className="ml-2 sm:hidden">
                    {showGuides ? "Masquer" : "Afficher"}
                  </span>
                </Button>
                <Button
                  size="sm"
                  disabled={!flyer || isExporting}
                  onClick={handleExport}
                >
                  <Download className="size-4" />
                  <span className="ml-2">
                    {isExporting ? "Export en cours…" : "Exporter PNG"}
                  </span>
                </Button>
              </div>
            </div>

            <FlyerStage
              state={editorState}
              className="mt-4"
              allowPlacements={Boolean(flyer)}
            />
          </section>
        </div>

        <aside className="w-full max-w-md space-y-6">
          <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Zones définies</h2>
                <p className="text-sm text-muted-foreground">
                  {zones.length}
                  {zones.length > 1 ? " zones" : " zone"} enregistrée
                  {zones.length > 1 ? "s" : ""}.
                </p>
              </div>
              {selectedZoneId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveZone(selectedZoneId)}
                >
                  Supprimer la zone
                </Button>
              )}
            </header>
            <div className="mt-4 space-y-3">
              {zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pas encore de zone. Activez le mode dessin puis cliquez sur le
                  canevas pour en créer une.
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
                    ? "Déposez une image pour l'insérer dans la zone choisie."
                    : "Sélectionnez une zone pour y associer une image."}
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
                    Formats : PNG, JPG. Les transformations se font directement
                    dans le canevas.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choisissez une zone avant d&apos;ajouter une image.
                </p>
              )}
            </div>
            {selectedPlacement && (
              <div className="mt-3 space-y-1 text-sm">
                <p className="font-medium">Image assignée</p>
                <p className="text-muted-foreground">
                  {selectedPlacement.fileName}
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
        </aside>
      </div>
    </div>
  );
}

export default FlyerEditor;
