import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

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

/**
 * Options pour configurer le comportement de l'éditeur de flyer
 */
export interface UseFlyerEditorOptions {
  /**
   * Active/désactive la possibilité d'ajouter des images dans les zones
   * @default true
   */
  allowPlacements?: boolean;

  /**
   * Active/désactive la possibilité de dessiner de nouvelles zones
   * @default true
   */
  allowDrawing?: boolean;

  /**
   * Callback appelé à chaque modification des zones
   * @param zones - Liste à jour des zones définies
   */
  onZonesChange?: (zones: Zone[]) => void;

  /**
   * Callback appelé à chaque modification des placements d'images
   * @param placements - Liste à jour des placements
   */
  onPlacementsChange?: (placements: Placement[]) => void;
}

/**
 * État et contrôleurs retournés par le hook useFlyerEditorState
 * @interface UseFlyerEditorState
 *
 * @property {FlyerImage | null} flyer - Image du flyer actuellement chargée
 * @property {Dispatch<SetStateAction<FlyerImage | null>>} setFlyer - Modifie l'image du flyer
 *
 * @property {Zone[]} zones - Liste des zones définies sur le flyer
 * @property {Record<string, Placement>} placements - Map des placements d'images par ID de zone
 * @property {NormalizedPoint[]} currentPoints - Points en cours de dessin
 *
 * @property {boolean} isDrawing - Mode dessin actif
 * @property {boolean} isTracing - Dessin en cours (pendant le drag)
 * @property {boolean} showGuides - Affichage des guides visuels
 * @property {boolean} isExporting - Mode export actif
 *
 * @property {string | null} selectedZoneId - ID de la zone sélectionnée
 * @property {number} stageWidth - Largeur du canevas Konva
 * @property {number} stageHeight - Hauteur du canevas Konva
 * @property {number} stageScale - Échelle du canevas
 *
 * @property {RefObject<HTMLDivElement | null>} containerRef - Référence du conteneur
 * @property {RefObject<Stage | null>} stageRef - Référence du stage Konva
 * @property {RefObject<Transformer | null>} transformerRef - Référence du transformer Konva
 * @property {RefObject<number>} stageScaleRef - Référence de l'échelle courante
 *
 * @property {(zoneId: string, node: KonvaImageShape | null) => void} registerImageNode - Enregistre un nœud image Konva
 * @property {() => void} toggleDrawMode - Bascule le mode dessin
 * @property {() => void} cancelDrawing - Annule le dessin en cours
 * @property {(zoneId: string) => void} handleSelectZone - Sélectionne une zone
 * @property {(zoneId: string) => void} handleRemoveZone - Supprime une zone
 *
 * @property {(event: KonvaEventObject<MouseEvent | TouchEvent>) => void} handlePointerDown - Gère le début du dessin
 * @property {() => void} handlePointerMove - Gère le mouvement pendant le dessin
 * @property {() => void} finishFreehand - Termine le dessin à main levée
 * @property {() => void} handlePointerLeave - Gère la sortie du pointeur
 *
 * @property {(zone: Zone, imageWidth: number, imageHeight: number, url: string, fileName: string) => Placement} computeInitialPlacement - Calcule le placement initial d'une image
 * @property {(zoneId: string, attrs: { position: NormalizedPoint; scale: number; rotation: number }) => void} handlePlacementChange - Met à jour un placement
 *
 * @property {Dispatch<SetStateAction<boolean>>} setShowGuides - Modifie l'affichage des guides
 * @property {Dispatch<SetStateAction<boolean>>} setIsExporting - Modifie le mode export
 * @property {Dispatch<SetStateAction<Record<string, Placement>>>} setPlacements - Modifie les placements
 * @property {Dispatch<SetStateAction<Zone[]>>} setZones - Modifie les zones
 * @property {(flyer: FlyerImage | null) => void} setFlyerImage - Configure une nouvelle image
 * @property {Dispatch<SetStateAction<string | null>>} setSelectedZoneId - Modifie la zone sélectionnée
 */
export interface UseFlyerEditorState {
  /**
   * Image du flyer actuellement chargée dans l'éditeur
   * Null si aucune image n'est chargée
   */
  flyer: FlyerImage | null;

  /**
   * Modifie directement l'image du flyer
   * Préférez utiliser setFlyerImage qui gère la réinitialisation complète
   */
  setFlyer: Dispatch<SetStateAction<FlyerImage | null>>;

  /**
   * Liste des zones polygonales définies sur le flyer
   * Chaque zone contient un ID, un nom et une liste de points normalisés
   */
  zones: Zone[];

  /**
   * Map des placements d'images indexée par l'ID de zone
   * Contient les informations de position, échelle et rotation pour chaque image
   */
  placements: Record<string, Placement>;

  /**
   * Points en cours de dessin lors de la création d'une zone
   * Points normalisés entre 0 et 1 relatifs aux dimensions du stage
   */
  currentPoints: NormalizedPoint[];

  /**
   * Indique si le mode dessin de zone est actif
   * Dans ce mode, les clics sur le canvas démarrent le tracé d'une nouvelle zone
   */
  isDrawing: boolean;

  /**
   * Indique si un tracé de zone est en cours
   * True pendant le dessin à main levée d'une zone
   */
  isTracing: boolean;

  /**
   * Contrôle l'affichage des guides visuels (grille, bordures...)
   */
  showGuides: boolean;

  /**
   * Indique si l'éditeur est en mode export
   * En mode export, les guides et contrôles sont masqués
   */
  isExporting: boolean;

  /**
   * ID de la zone actuellement sélectionnée
   * Null si aucune zone n'est sélectionnée
   */
  selectedZoneId: string | null;

  /**
   * Largeur actuelle du stage Konva en pixels
   * Dépend de la taille du conteneur
   */
  stageWidth: number;

  /**
   * Hauteur actuelle du stage Konva en pixels
   * Calculée pour maintenir le ratio de l'image
   */
  stageHeight: number;

  /**
   * Échelle actuelle du stage
   * Utilisée pour normaliser les coordonnées
   */
  stageScale: number;

  /**
   * Référence du conteneur HTML dans lequel le stage est monté
   * Permet de gérer le redimensionnement réactif
   */
  containerRef: RefObject<HTMLDivElement | null>;

  /**
   * Référence du stage Konva
   * Utilisée pour accéder aux méthodes du stage (ex: getPointerPosition)
   */
  stageRef: RefObject<Stage | null>;

  /**
   * Référence du transformer Konva
   * Utilisée pour gérer la transformation (redimensionnement, rotation) des zones
   */
  transformerRef: RefObject<Transformer | null>;

  /**
   * Référence de l'échelle courante du stage
   * Utilisée pour des opérations dépendant de l'échelle (ex: placement d'images)
   */
  stageScaleRef: RefObject<number>;

  /**
   * Fonction d'enregistrement d'un nœud image Konva
   * @param zoneId - ID de la zone à laquelle l'image est associée
   * @param node - Référence au nœud image Konva
   */
  registerImageNode: (zoneId: string, node: KonvaImageShape | null) => void;

  /**
   * Active/désactive le mode dessin de zone
   * Réinitialise l'état de dessin et la sélection
   */
  toggleDrawMode: VoidFunction;

  /**
   * Annule le dessin en cours
   * Réinitialise les points et états de dessin
   */
  cancelDrawing: VoidFunction;

  /**
   * Sélectionne une zone existante
   * Met à jour l'état pour commencer à modifier cette zone
   * @param zoneId - ID de la zone à sélectionner
   */
  handleSelectZone: (zoneId: string) => void;

  /**
   * Supprime une zone existante
   * @param zoneId - ID de la zone à supprimer
   */
  handleRemoveZone: (zoneId: string) => void;

  /**
   * Gère le début du dessin d'une zone
   * @param event - Événement de pointeur contenant la position du clic
   */
  handlePointerDown: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;

  /**
   * Gère le mouvement du pointeur pendant le dessin
   * Ajoute des points à la zone en cours de dessin
   */
  handlePointerMove: VoidFunction;

  /**
   * Termine le dessin à main levée d'une zone
   * Appelé lorsque l'utilisateur relâche le bouton de la souris ou quitte le canevas
   */
  finishFreehand: VoidFunction;

  /**
   * Gère la sortie du pointeur du canevas
   * Termine le dessin en cours si nécessaire
   */
  handlePointerLeave: VoidFunction;

  /**
   * Calcule le placement initial d'une image dans une zone
   * Utilisé lors de l'ajout d'une nouvelle image
   * @param zone - Zone dans laquelle l'image est placée
   * @param imageWidth - Largeur de l'image
   * @param imageHeight - Hauteur de l'image
   * @param url - URL de l'image
   * @param fileName - Nom de fichier de l'image (pour le téléchargement)
   * @returns Placement initial pour l'image
   */
  computeInitialPlacement: (
    zone: Zone,
    imageWidth: number,
    imageHeight: number,
    url: string,
    fileName: string
  ) => Placement;

  /**
   * Met à jour les attributs d'un placement existant
   * @param zoneId - ID de la zone contenant le placement
   * @param attrs - Attributs à mettre à jour (position, échelle, rotation)
   */
  handlePlacementChange: (
    zoneId: string,
    attrs: { position: NormalizedPoint; scale: number; rotation: number }
  ) => void;

  /**
   * Modifie l'affichage des guides visuels (grille, bordures...)
   * @param show - True pour afficher les guides, false pour les masquer
   */
  setShowGuides: Dispatch<SetStateAction<boolean>>;

  /**
   * Modifie le mode export
   * @param exporting - True pour activer le mode export, false pour le désactiver
   */
  setIsExporting: Dispatch<SetStateAction<boolean>>;

  /**
   * Modifie les placements d'images
   * @param placements - Nouvel état des placements
   */
  setPlacements: Dispatch<SetStateAction<Record<string, Placement>>>;

  /**
   * Modifie les zones polygonales
   * @param zones - Nouvel état des zones
   */
  setZones: Dispatch<SetStateAction<Zone[]>>;

  /**
   * Configure une nouvelle image de flyer
   * Réinitialise l'état de l'éditeur (zones, placements, dessin en cours)
   * @param flyer - Nouvelle image du flyer
   */
  setFlyerImage: (flyer: FlyerImage | null) => void;

  /**
   * Modifie la zone sélectionnée
   * @param zoneId - ID de la nouvelle zone sélectionnée
   */
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
}

/**
 * Hook personnalisé pour implémenter un éditeur de flyer interactif avec Konva
 *
 * Gère :
 * - L'affichage et le dimensionnement de l'image du flyer
 * - Le dessin de zones polygonales sur le flyer
 * - La sélection et modification des zones
 * - Le placement et transformation d'images dans les zones
 *
 * @param initialFlyer - Image du flyer à charger initialement
 * @param initialZones - Zones à créer au montage du composant
 * @param initialPlacements - Placements d'images à créer au montage
 * @param options - Options de configuration de l'éditeur
 *
 * @returns Un objet contenant l'état complet et les contrôleurs de l'éditeur
 *
 * @example
 * ```tsx
 * const editor = useFlyerEditorState(null, [], [], {
 *   allowPlacements: false,
 *   allowDrawing: true
 * });
 *
 * return (
 *   <FlyerStage state={editor} />
 * );
 * ```
 */

export function useFlyerEditorState(
  initialFlyer: FlyerImage | null,
  initialZones: Zone[],
  initialPlacements: Placement[],
  options: UseFlyerEditorOptions = {}
): UseFlyerEditorState {
  // Extraction des options avec valeurs par défaut
  const {
    allowPlacements = true, // Autorise l'ajout d'images dans les zones
    allowDrawing = true, // Autorise le dessin de nouvelles zones
    onZonesChange, // Callback pour notifier des changements de zones
    onPlacementsChange, // Callback pour notifier des changements de placements
  } = options;

  // États principaux
  const [flyer, setFlyer] = useState<FlyerImage | null>(initialFlyer); // Image du flyer
  const [zones, setZones] = useState<Zone[]>(initialZones); // Zones définies
  const [placements, setPlacementsState] = useState<Record<string, Placement>>(
    () =>
      // Map des placements
      Object.fromEntries(initialPlacements.map((p) => [p.zoneId, p]))
  );
  const [currentPoints, setCurrentPoints] = useState<NormalizedPoint[]>([]); // Points du dessin en cours
  const [isDrawing, setIsDrawing] = useState(false); // Mode dessin actif
  const [isTracing, setIsTracing] = useState(false); // Dessin en cours (pendant drag)
  const [showGuides, setShowGuides] = useState(true); // Affichage des guides
  const [isExporting, setIsExporting] = useState(false); // Mode export
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null); // Zone sélectionnée
  const [containerWidth, setContainerWidth] = useState(0); // Largeur du conteneur

  // Références DOM et état
  const containerRef = useRef<HTMLDivElement | null>(null); // Conteneur du stage
  const stageRef = useRef<Stage | null>(null); // Stage Konva
  const transformerRef = useRef<Transformer | null>(null); // Transformer Konva
  const imageNodeMapRef = useRef<Map<string, KonvaImageShape>>(new Map()); // Map des nœuds image Konva
  const stageScaleRef = useRef(1); // Échelle courante
  const currentPointsRef = useRef<NormalizedPoint[]>([]); // Points en cours (pour perf)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null); // Dernière position pointeur

  // Calcul des dimensions du stage
  const stageWidth = flyer && containerWidth > 0 ? containerWidth : 0;
  const stageScale = flyer && stageWidth > 0 ? stageWidth / flyer.width : 1;
  const stageHeight = flyer && stageWidth > 0 ? flyer.height * stageScale : 0;

  // Synchronisation des refs avec l'état
  useEffect(() => {
    currentPointsRef.current = currentPoints; // Garde une copie à jour pour les handlers
  }, [currentPoints]);

  useEffect(() => {
    stageScaleRef.current = stageScale; // Garde l'échelle à jour pour les calculs
  }, [stageScale]);

  // Observer la taille du conteneur
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

  // Initialisation de la largeur du conteneur
  useEffect(() => {
    if (!flyer) return;

    if (!containerRef.current) return;

    if (containerWidth > 0) return;

    const width = containerRef.current.clientWidth;

    if (width > 0) {
      setContainerWidth(width);
    }
  }, [containerWidth, flyer]);

  // Handler pour charger une nouvelle image
  const setFlyerImage = useCallback((nextFlyer: FlyerImage | null) => {
    setFlyer(nextFlyer);
    setPlacementsState({}); // Réinitialise les placements
    setZones([]); // Réinitialise les zones
    setCurrentPoints([]); // Réinitialise le dessin
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

  /**
   * attachTransformer : Gère l'attachement du transformer Konva aux zones
   *
   * 1. Vérifie si le transformer existe
   * 2. Si pas de zone sélectionnée ou guides masqués :
   *    - Détache le transformer (nodes vides)
   *    - Force le rafraîchissement du layer
   * 3. Sinon :
   *    - Récupère le nœud Konva de la zone
   *    - Attache le transformer au nœud s'il existe
   *    - Force le rafraîchissement
   */
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

  /**
   * registerImageNode : Enregistre un nœud Konva pour une zone donnée
   *
   * Utilisé pour :
   * - Garder une référence des nœuds image Konva
   * - Permettre l'attachement du transformer
   * - Gérer le cycle de vie des nœuds (cleanup)
   *
   * @param zoneId ID de la zone
   * @param node Nœud Konva à enregistrer (null pour supprimer)
   */
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

  /**
   * finalizeZone : Finalise le dessin d'une zone
   *
   * 1. Vérifie les conditions (dessin autorisé, nombre min de points)
   * 2. Filtre les points trop proches (MIN_SAMPLE_DISTANCE_PX)
   * 3. Crée une nouvelle zone avec :
   *    - ID unique
   *    - Nom automatique
   *    - Points filtrés
   * 4. Met à jour l'état :
   *    - Ajoute la zone
   *    - Réinitialise les placements
   *    - Sélectionne la nouvelle zone
   *    - Nettoie l'état de dessin
   */
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

  /**
   * startFreehand : Démarre le dessin à main levée
   *
   * 1. Vérifie si le dessin est autorisé
   * 2. Convertit la position du pointeur en coordonnées normalisées
   * 3. Initialise les refs et états pour le tracé
   */
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

  /**
   * handlePointerDown : Gère le début d'interaction
   *
   * Deux modes :
   * 1. Mode dessin :
   *    - Vérifie si le clic est sur le stage
   *    - Démarre le dessin à main levée
   * 2. Mode normal :
   *    - Désélectionne la zone si clic sur le stage
   */
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

  /**
   * handlePointerMove : Gère le mouvement pendant le dessin
   *
   * 1. Vérifie si on est en mode tracé
   * 2. Récupère la position du pointeur
   * 3. Filtre les points trop proches
   * 4. Ajoute le nouveau point normalisé
   * 5. Met à jour l'état et la ref des points
   */
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

  /**
   * finishFreehand : Termine le dessin à main levée
   *
   * 1. Vérifie si on est en train de tracer
   * 2. Réinitialise l'état de tracé
   * 3. Récupère les points accumulés
   * 4. Tente de finaliser la zone
   * 5. Nettoie les points si échec
   */
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

  /**
   * toggleDrawMode : Bascule le mode dessin
   *
   * 1. Vérifie si le dessin est possible
   * 2. Réinitialise tous les états de dessin
   * 3. Inverse l'état du mode dessin
   * 4. Désélectionne la zone courante
   */
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

  /**
   * computeInitialPlacement : Calcule le placement optimal d'une image
   *
   * 1. Calcule les dimensions de la zone
   * 2. Détermine l'échelle pour couvrir la zone
   * 3. Calcule la position centrée
   * 4. Applique les contraintes de bord
   * 5. Normalise les coordonnées
   */
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

  /**
   * Met à jour les attributs d'un placement existant
   * @param zoneId - ID de la zone contenant le placement
   * @param attrs - Attributs à mettre à jour (position, échelle, rotation)
   */
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
