"use client";

import { useCallback, useMemo, useRef } from "react";
import { Group, Image as KonvaImage } from "react-konva";
import type { Image as KonvaImageShape } from "konva/lib/shapes/Image";
import useImage from "use-image";

import { clamp, stagePointFromNormalized } from "@/lib/geometry";
import type { NormalizedPoint, Placement, Zone } from "@/lib/types";

export interface ZoneImageProps {
  zone: Zone;
  placement: Placement;
  stageWidth: number;
  stageHeight: number;
  stageScale: number;
  disabled?: boolean;
  registerRef: (zoneId: string, node: KonvaImageShape | null) => void;
  onSelect: (zoneId: string) => void;
  onChange: (
    zoneId: string,
    attrs: { position: NormalizedPoint; scale: number; rotation: number }
  ) => void;
}

export function ZoneImage({
  zone,
  placement,
  stageWidth,
  stageHeight,
  stageScale,
  disabled,
  registerRef,
  onSelect,
  onChange,
}: ZoneImageProps) {
  const [image] = useImage(placement.url, "anonymous");
  const imageNodeRef = useRef<KonvaImageShape | null>(null);

  const stageScaleValue = placement.scale * stageScale;
  const stagePosition = {
    x: placement.position.x * stageWidth,
    y: placement.position.y * stageHeight,
  };

  const zonePoints = useMemo(
    () =>
      zone.points
        .map((point) => {
          const stagePoint = stagePointFromNormalized(
            point,
            stageWidth,
            stageHeight
          );
          return [stagePoint.x, stagePoint.y] as const;
        })
        .flat(),
    [zone.points, stageHeight, stageWidth]
  );

  const handleRegisterRef = useCallback(
    (node: KonvaImageShape | null) => {
      imageNodeRef.current = node;
      registerRef(zone.id, node);
    },
    [registerRef, zone.id]
  );

  const handleDragEnd = useCallback(() => {
    if (disabled) return;
    const node = imageNodeRef.current;
    if (!node) return;

    const newX = clamp(node.x(), 0, stageWidth);
    const newY = clamp(node.y(), 0, stageHeight);
    const normalizedScale = node.scaleX() / stageScale;
    const rotation = node.rotation();

    onChange(zone.id, {
      position: {
        x: newX / stageWidth,
        y: newY / stageHeight,
      },
      scale: normalizedScale,
      rotation,
    });
  }, [disabled, onChange, stageHeight, stageScale, stageWidth, zone.id]);

  const handleTransformEnd = useCallback(() => {
    if (disabled) return;
    const node = imageNodeRef.current;
    if (!node) return;

    const normalizedScale = node.scaleX() / stageScale;
    const newRotation = node.rotation();
    const newX = clamp(node.x(), 0, stageWidth) / stageWidth;
    const newY = clamp(node.y(), 0, stageHeight) / stageHeight;

    onChange(zone.id, {
      position: { x: newX, y: newY },
      scale: normalizedScale,
      rotation: newRotation,
    });
  }, [disabled, onChange, stageHeight, stageScale, stageWidth, zone.id]);

  if (!image) return null;

  return (
    <Group
      clipFunc={(ctx) => {
        if (zonePoints.length < 4) return;
        ctx.beginPath();
        ctx.moveTo(zonePoints[0], zonePoints[1]);
        for (let i = 2; i < zonePoints.length; i += 2) {
          ctx.lineTo(zonePoints[i], zonePoints[i + 1]);
        }
        ctx.closePath();
      }}
      listening={!disabled}
    >
      <KonvaImage
        image={image}
        x={stagePosition.x}
        y={stagePosition.y}
        scaleX={stageScaleValue}
        scaleY={stageScaleValue}
        rotation={placement.rotation}
        draggable={!disabled}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => !disabled && onSelect(zone.id)}
        onTap={() => !disabled && onSelect(zone.id)}
        ref={handleRegisterRef}
      />
    </Group>
  );
}

export default ZoneImage;
