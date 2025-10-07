import type { NormalizedPoint } from "@/lib/types";

export const MIN_POINTS = 3;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalizedPointFromStage(
  stagePoint: { x: number; y: number },
  stageWidth: number,
  stageHeight: number
): NormalizedPoint {
  const safeWidth = Math.max(stageWidth, 1);
  const safeHeight = Math.max(stageHeight, 1);
  return {
    x: clamp(stagePoint.x / safeWidth, 0, 1),
    y: clamp(stagePoint.y / safeHeight, 0, 1),
  } satisfies NormalizedPoint;
}

export function stagePointFromNormalized(
  point: NormalizedPoint,
  stageWidth: number,
  stageHeight: number
) {
  return {
    x: point.x * stageWidth,
    y: point.y * stageHeight,
  };
}

export function getPolygonBounds(points: NormalizedPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export function getPolygonCentroid(points: NormalizedPoint[]) {
  if (!points.length) {
    return { x: 0, y: 0 } satisfies NormalizedPoint;
  }
  const { minX, maxX, minY, maxY } = getPolygonBounds(points);
  return {
    x: minX + (maxX - minX) / 2,
    y: minY + (maxY - minY) / 2,
  } satisfies NormalizedPoint;
}
