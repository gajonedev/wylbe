"use client";

import { useMemo } from "react";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import useImage from "use-image";

import { cn } from "@/lib/utils";
import { getPolygonCentroid, stagePointFromNormalized } from "@/lib/geometry";
import type { UseFlyerEditorState } from "@/components/editor/hooks/useFlyerEditorState";
import ZoneImage from "@/components/editor/canvas/ZoneImage";

/**
 * Props du composant FlyerStage
 * @interface FlyerStageProps
 * @property {UseFlyerEditorState} state - État complet de l'éditeur fourni par le hook useFlyerEditorState
 * @property {string} [className] - Classes CSS additionnelles pour le conteneur
 * @property {boolean} [allowPlacements=true] - Active/désactive le placement d'images dans les zones
 */
interface FlyerStageProps {
  state: UseFlyerEditorState;
  className?: string;
  allowPlacements?: boolean;
}

/**
 * Composant FlyerStage
 * --------------------
 * Canevas interactif pour l'édition de flyers avec zones cliquables.
 * Utilise Konva.js pour le rendu canvas et la gestion des interactions.
 *
 * Fonctionnalités :
 * 1. Affichage de l'image du flyer en arrière-plan
 * 2. Rendu des zones interactives avec leurs noms
 * 3. Gestion du dessin à main levée des zones
 * 4. Placement et transformation d'images dans les zones
 * 5. Sélection et mise en évidence des zones
 *
 * Structure des layers :
 * - Layer 1 : Image de fond (non interactif)
 * - Layer 2 : Zones, dessin en cours, images placées, transformer
 */
export function FlyerStage({
  state,
  className,
  allowPlacements = true,
}: FlyerStageProps) {
  // Extraction des props de l'état de l'éditeur
  const {
    flyer, // Image du flyer
    stageWidth, // Largeur du canevas
    stageHeight, // Hauteur du canevas
    stageScale, // Échelle du canevas
    containerRef, // Ref du conteneur
    stageRef, // Ref du stage Konva
    transformerRef, // Ref du transformer Konva
    zones, // Zones définies
    placements, // Images placées
    currentPoints, // Points du dessin en cours
    isDrawing, // Mode dessin actif
    showGuides, // Affichage des guides
    handlePointerMove, // Handler mouvement
    handlePointerDown, // Handler clic/touch
    finishFreehand, // Handler fin de dessin
    handlePointerLeave, // Handler sortie de canevas
    registerImageNode, // Enregistrement des nœuds image
    handleSelectZone, // Sélection de zone
    handlePlacementChange, // Modification de placement
    selectedZoneId, // ID zone sélectionnée
  } = state;

  /**
   * Calcul mémoïsé des overlays de zones
   * Génère les éléments Konva pour visualiser les zones :
   * - Contour polygonal avec style selon sélection
   * - Texte du nom de la zone centré
   */
  const zoneOverlays = useMemo(() => {
    if (!showGuides) return null;

    return zones.map((zone) => {
      // Conversion des points normalisés en coordonnées canvas
      const stagePoints = zone.points
        .map((point) => {
          const { x, y } = stagePointFromNormalized(
            point,
            stageWidth,
            stageHeight
          );
          return [x, y] as const;
        })
        .flat();

      const isSelected = zone.id === selectedZoneId;

      // Calcul du centre pour le texte
      const centroid = stagePointFromNormalized(
        getPolygonCentroid(zone.points),
        stageWidth,
        stageHeight
      );

      return (
        <Group key={zone.id}>
          <Line
            points={stagePoints}
            closed
            stroke={isSelected ? "#38bdf8" : "rgba(148,163,184,0.75)"}
            strokeWidth={isSelected ? 3 : 2}
            fill={
              isSelected ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.12)"
            }
            lineCap="round"
            lineJoin="round"
            onClick={() => handleSelectZone(zone.id)}
            onTap={() => handleSelectZone(zone.id)}
          />
          <Text
            text={zone.name}
            x={centroid.x - 24}
            y={centroid.y - 10}
            fill="white"
            fontSize={14}
            listening={false}
          />
        </Group>
      );
    });
  }, [
    handleSelectZone,
    selectedZoneId,
    showGuides,
    stageHeight,
    stageWidth,
    zones,
  ]);

  /**
   * Calcul mémoïsé des points du dessin en cours
   * Convertit les points normalisés en coordonnées canvas
   */
  const currentStagePoints = useMemo(
    () =>
      currentPoints
        .map((point) => {
          const { x, y } = stagePointFromNormalized(
            point,
            stageWidth,
            stageHeight
          );
          return [x, y] as const;
        })
        .flat(),
    [currentPoints, stageHeight, stageWidth]
  );

  // console.log("Data: ", flyer, stageWidth, stageHeight);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full items-center justify-center overflow-hidden border border-border/40 bg-muted/30",
        className
      )}
    >
      {flyer && stageWidth > 0 && stageHeight > 0 ? (
        <Stage
          width={stageWidth}
          height={stageHeight}
          ref={(node) => {
            stageRef.current = node;
          }}
          onMouseMove={handlePointerMove}
          onMouseDown={handlePointerDown}
          onMouseUp={finishFreehand}
          onMouseLeave={handlePointerLeave}
          onTouchMove={handlePointerMove}
          onTouchStart={handlePointerDown}
          onTouchEnd={finishFreehand}
          className="bg-black/10"
        >
          <Layer listening={false}>
            <FlyerBackground
              url={flyer.url}
              width={stageWidth}
              height={stageHeight}
            />
          </Layer>
          <Layer>
            {zoneOverlays}
            {showGuides && isDrawing && currentPoints.length > 0 && (
              <Line
                points={currentStagePoints}
                stroke="#f97316"
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {allowPlacements &&
              zones.map((zone) => {
                const placement = placements[zone.id];
                if (!placement) return null;
                return (
                  <ZoneImage
                    key={`zone-image-${zone.id}`}
                    zone={zone}
                    placement={placement}
                    stageWidth={stageWidth}
                    stageHeight={stageHeight}
                    stageScale={stageScale}
                    registerRef={registerImageNode}
                    onSelect={handleSelectZone}
                    onChange={handlePlacementChange}
                    disabled={isDrawing}
                  />
                );
              })}
            <Transformer
              ref={transformerRef}
              rotateEnabled={true}
              visible={showGuides && allowPlacements}
            />
          </Layer>
        </Stage>
      ) : (
        <div className="flex h-[360px] w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <p>Importez un flyer pour activer le canevas.</p>
          <p>
            Le fichier s&apos;affichera ici et vous pourrez tracer des zones
            interactives.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Composant FlyerBackground
 * ------------------------
 * Gère l'affichage de l'image de fond du flyer.
 * Utilise use-image pour charger l'image de manière optimisée.
 *
 * @param url - URL de l'image à charger
 * @param width - Largeur souhaitée
 * @param height - Hauteur souhaitée
 */
function FlyerBackground({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) {
  // Chargement de l'image avec gestion CORS
  const [image] = useImage(url, "anonymous");
  if (!image) return null;

  // Rendu de l'image non interactive
  return (
    <KonvaImage image={image} width={width} height={height} listening={false} />
  );
}

export default FlyerStage;
