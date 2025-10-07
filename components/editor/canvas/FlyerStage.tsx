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

interface FlyerStageProps {
  state: UseFlyerEditorState;
  className?: string;
  allowPlacements?: boolean;
}

export function FlyerStage({
  state,
  className,
  allowPlacements = true,
}: FlyerStageProps) {
  const {
    flyer,
    stageWidth,
    stageHeight,
    stageScale,
    containerRef,
    stageRef,
    transformerRef,
    zones,
    placements,
    currentPoints,
    isDrawing,
    showGuides,
    handlePointerMove,
    handlePointerDown,
    finishFreehand,
    handlePointerLeave,
    registerImageNode,
    handleSelectZone,
    handlePlacementChange,
    selectedZoneId,
  } = state;

  const zoneOverlays = useMemo(() => {
    if (!showGuides) return null;
    return zones.map((zone) => {
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

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/30",
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

function FlyerBackground({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) {
  const [image] = useImage(url, "anonymous");
  if (!image) return null;
  return (
    <KonvaImage image={image} width={width} height={height} listening={false} />
  );
}

export default FlyerStage;
