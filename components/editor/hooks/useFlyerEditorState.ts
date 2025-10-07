import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import {
  MIN_POINTS,
  clamp,
  distance,
  getPolygonBounds,
  normalizedPointFromStage,
} from "@/lib/geometry";
import type { FlyerImage, NormalizedPoint, Placement, Zone } from "@/lib/types";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type { Transformer } from "konva/lib/shapes/Transformer";
import type { Image as KonvaImageShape } from "konva/lib/shapes/Image";

export const MIN_SAMPLE_DISTANCE_PX = 6;

export interface UseFlyerEditorOptions {
  allowPlacements?: boolean;
  allowDrawing?: boolean;
  onZonesChange?: (zones: Zone[]) => void;
  onPlacementsChange?: (placements: Placement[]) => void;
}

export interface UseFlyerEditorState {
  flyer: FlyerImage | null;
  setFlyer: Dispatch<SetStateAction<FlyerImage | null>>;
  zones: Zone[];
  placements: Record<string, Placement>;
  currentPoints: NormalizedPoint[];
  isDrawing: boolean;
  isTracing: boolean;
  showGuides: boolean;
  isExporting: boolean;
  selectedZoneId: string | null;
  stageWidth: number;
  stageHeight: number;
  stageScale: number;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  stageRef: MutableRefObject<Stage | null>;
  transformerRef: MutableRefObject<Transformer | null>;
  stageScaleRef: MutableRefObject<number>;
  registerImageNode: (zoneId: string, node: KonvaImageShape | null) => void;
  toggleDrawMode: VoidFunction;
  cancelDrawing: VoidFunction;
  handleSelectZone: (zoneId: string) => void;
  handleRemoveZone: (zoneId: string) => void;
  handlePointerDown: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handlePointerMove: VoidFunction;
  finishFreehand: VoidFunction;
  handlePointerLeave: VoidFunction;
  computeInitialPlacement: (
    zone: Zone,
    imageWidth: number,
    imageHeight: number,
    url: string,
    fileName: string
  ) => Placement;
  handlePlacementChange: (
    zoneId: string,
    attrs: { position: NormalizedPoint; scale: number; rotation: number }
  ) => void;
  setShowGuides: Dispatch<SetStateAction<boolean>>;
  setIsExporting: Dispatch<SetStateAction<boolean>>;
  setPlacements: Dispatch<SetStateAction<Record<string, Placement>>>;
  setZones: Dispatch<SetStateAction<Zone[]>>;
  setFlyerImage: (flyer: FlyerImage | null) => void;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
}

export function useFlyerEditorState(
  initialFlyer: FlyerImage | null,
  initialZones: Zone[],
  initialPlacements: Placement[],
  options: UseFlyerEditorOptions = {}
): UseFlyerEditorState {
  const {
    allowPlacements = true,
    allowDrawing = true,
    onZonesChange,
    onPlacementsChange,
  } = options;

  const [flyer, setFlyer] = useState<FlyerImage | null>(initialFlyer);
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [placements, setPlacementsState] = useState<Record<string, Placement>>(
    () =>
      Object.fromEntries(
        initialPlacements.map((placement) => [placement.zoneId, placement])
      )
  );
  const [currentPoints, setCurrentPoints] = useState<NormalizedPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const transformerRef = useRef<Transformer | null>(null);
  const imageNodeMapRef = useRef<Map<string, KonvaImageShape>>(new Map());
  const stageScaleRef = useRef(1);
  const currentPointsRef = useRef<NormalizedPoint[]>([]);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const stageWidth = flyer && containerWidth > 0 ? containerWidth : 0;
  const stageScale = flyer && stageWidth > 0 ? stageWidth / flyer.width : 1;
  const stageHeight = flyer && stageWidth > 0 ? flyer.height * stageScale : 0;

  useEffect(() => {
    currentPointsRef.current = currentPoints;
  }, [currentPoints]);

  useEffect(() => {
    stageScaleRef.current = stageScale;
  }, [stageScale]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const setFlyerImage = useCallback((nextFlyer: FlyerImage | null) => {
    setFlyer(nextFlyer);
    setPlacementsState({});
    setZones([]);
    setCurrentPoints([]);
    setIsDrawing(false);
    setIsTracing(false);
    setShowGuides(true);
    setSelectedZoneId(null);
    currentPointsRef.current = [];
    lastPointerRef.current = null;
  }, []);

  useEffect(() => {
    onZonesChange?.(zones);
  }, [onZonesChange, zones]);

  useEffect(() => {
    onPlacementsChange?.(Object.values(placements));
  }, [onPlacementsChange, placements]);

  const attachTransformer = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (!selectedZoneId || !showGuides) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }
    const node = imageNodeMapRef.current.get(selectedZoneId);
    if (node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedZoneId, showGuides]);

  const registerImageNode = useCallback(
    (zoneId: string, node: KonvaImageShape | null) => {
      if (node) {
        imageNodeMapRef.current.set(zoneId, node);
      } else {
        imageNodeMapRef.current.delete(zoneId);
      }
      if (zoneId === selectedZoneId) {
        requestAnimationFrame(() => {
          attachTransformer();
        });
      }
    },
    [attachTransformer, selectedZoneId]
  );

  useEffect(() => {
    attachTransformer();
  }, [attachTransformer, placements, stageWidth, stageHeight]);

  const finalizeZone = useCallback(
    (points: NormalizedPoint[]) => {
      if (!allowDrawing) return false;
      if (points.length < MIN_POINTS) {
        return false;
      }

      const filtered = points.reduce<NormalizedPoint[]>((acc, point) => {
        if (acc.length === 0) {
          acc.push(point);
          return acc;
        }
        const prev = acc[acc.length - 1];
        const pixelDistance = Math.hypot(
          (point.x - prev.x) * stageWidth,
          (point.y - prev.y) * stageHeight
        );
        if (pixelDistance >= MIN_SAMPLE_DISTANCE_PX / 2) {
          acc.push(point);
        }
        return acc;
      }, []);

      if (filtered.length < MIN_POINTS) {
        return false;
      }

      const id = crypto.randomUUID();
      const name = `Zone ${zones.length + 1}`;
      const newZone: Zone = {
        id,
        name,
        points: filtered,
      };

      setZones((prev) => [...prev, newZone]);
      setPlacementsState((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });
      setSelectedZoneId(id);
      setCurrentPoints([]);
      currentPointsRef.current = [];
      setIsDrawing(false);
      return true;
    },
    [allowDrawing, stageHeight, stageWidth, zones.length]
  );

  const startFreehand = useCallback(
    (pointer: { x: number; y: number }) => {
      if (!allowDrawing) return;
      const normalized = normalizedPointFromStage(
        pointer,
        stageWidth,
        stageHeight
      );
      lastPointerRef.current = pointer;
      currentPointsRef.current = [normalized];
      setCurrentPoints([normalized]);
      setIsTracing(true);
    },
    [allowDrawing, stageHeight, stageWidth]
  );

  const handlePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!flyer || !stageRef.current) return;
      const stage = stageRef.current;
      const clickedOnStage = event.target === stage;

      if (!isDrawing) {
        if (clickedOnStage) {
          setSelectedZoneId(null);
        }
        return;
      }

      if (!clickedOnStage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      startFreehand(pointer);
    },
    [flyer, isDrawing, startFreehand]
  );

  const handlePointerMove = useCallback(() => {
    if (!isTracing || !stageRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    const lastPoint = lastPointerRef.current;
    if (lastPoint && distance(pointer, lastPoint) < MIN_SAMPLE_DISTANCE_PX) {
      return;
    }

    const normalized = normalizedPointFromStage(
      pointer,
      stageWidth,
      stageHeight
    );

    lastPointerRef.current = pointer;
    setCurrentPoints((prev) => {
      const next = [...prev, normalized];
      currentPointsRef.current = next;
      return next;
    });
  }, [isTracing, stageHeight, stageWidth]);

  const finishFreehand = useCallback(() => {
    if (!isTracing) return;
    setIsTracing(false);
    lastPointerRef.current = null;

    const points = currentPointsRef.current;
    currentPointsRef.current = [];

    if (!finalizeZone(points)) {
      setCurrentPoints([]);
    }
  }, [finalizeZone, isTracing]);

  const handlePointerLeave = useCallback(() => {
    finishFreehand();
  }, [finishFreehand]);

  const toggleDrawMode = useCallback(() => {
    if (!flyer || !allowDrawing) return;
    setCurrentPoints([]);
    currentPointsRef.current = [];
    lastPointerRef.current = null;
    setIsTracing(false);
    setIsDrawing((prev) => !prev);
    setSelectedZoneId(null);
  }, [allowDrawing, flyer]);

  const cancelDrawing = useCallback(() => {
    setCurrentPoints([]);
    currentPointsRef.current = [];
    lastPointerRef.current = null;
    setIsDrawing(false);
    setIsTracing(false);
  }, []);

  const handleSelectZone = useCallback((zoneId: string) => {
    setSelectedZoneId(zoneId);
    setIsDrawing(false);
    setCurrentPoints([]);
    currentPointsRef.current = [];
    lastPointerRef.current = null;
    setIsTracing(false);
  }, []);

  const handleRemoveZone = useCallback(
    (zoneId: string) => {
      setZones((prev) => prev.filter((zone) => zone.id !== zoneId));
      if (!allowPlacements) return;
      setPlacementsState((prev) => {
        const clone = { ...prev };
        delete clone[zoneId];
        return clone;
      });
      setSelectedZoneId((prev) => (prev === zoneId ? null : prev));
    },
    [allowPlacements]
  );

  const computeInitialPlacement = useCallback(
    (
      zone: Zone,
      imageWidth: number,
      imageHeight: number,
      url: string,
      fileName: string
    ): Placement => {
      const { minX, minY, width, height } = getPolygonBounds(zone.points);
      const zoneStageWidth = Math.max(width * stageWidth, 1);
      const zoneStageHeight = Math.max(height * stageHeight, 1);

      const coverScaleStage = Math.max(
        zoneStageWidth / imageWidth,
        zoneStageHeight / imageHeight
      );
      const normalizedScale = coverScaleStage / (stageScaleRef.current || 1);

      const maxX = Math.max(stageWidth - imageWidth * coverScaleStage, 0);
      const maxY = Math.max(stageHeight - imageHeight * coverScaleStage, 0);

      const stageX = clamp(
        minX * stageWidth +
          zoneStageWidth / 2 -
          (imageWidth * coverScaleStage) / 2,
        0,
        maxX
      );
      const stageY = clamp(
        minY * stageHeight +
          zoneStageHeight / 2 -
          (imageHeight * coverScaleStage) / 2,
        0,
        maxY
      );

      return {
        zoneId: zone.id,
        url,
        fileName,
        imageWidth,
        imageHeight,
        position: {
          x: stageX / stageWidth,
          y: stageY / stageHeight,
        },
        scale: normalizedScale,
        rotation: 0,
      };
    },
    [stageHeight, stageWidth]
  );

  const handlePlacementChange = useCallback(
    (
      zoneId: string,
      attrs: { position: NormalizedPoint; scale: number; rotation: number }
    ) => {
      setPlacementsState((prev) => {
        const current = prev[zoneId];
        if (!current) return prev;
        return {
          ...prev,
          [zoneId]: {
            ...current,
            position: attrs.position,
            scale: attrs.scale,
            rotation: attrs.rotation,
          },
        };
      });
    },
    []
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    transformer.keepRatio(true);
    transformer.rotateEnabled(true);
    transformer.enabledAnchors([
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]);
  }, []);

  return {
    flyer,
    setFlyer,
    zones,
    placements,
    currentPoints,
    isDrawing,
    isTracing,
    showGuides,
    isExporting,
    selectedZoneId,
    stageWidth,
    stageHeight,
    stageScale,
    containerRef,
    stageRef,
    transformerRef,
    stageScaleRef,
    registerImageNode,
    toggleDrawMode,
    cancelDrawing,
    handleSelectZone,
    handleRemoveZone,
    handlePointerDown,
    handlePointerMove,
    finishFreehand,
    handlePointerLeave,
    computeInitialPlacement,
    handlePlacementChange,
    setShowGuides,
    setIsExporting,
    setPlacements: setPlacementsState,
    setZones,
    setFlyerImage,
    setSelectedZoneId,
  };
}
