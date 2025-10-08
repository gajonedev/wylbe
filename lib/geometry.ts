import type { NormalizedPoint } from "@/lib/types";

/**
 * Nombre minimum de points requis pour former une zone valide
 * @constant {number}
 */
export const MIN_POINTS = 3;

/**
 * Contraint une valeur numérique entre une borne minimale et maximale
 *
 * @param {number} value - Valeur à contraindre
 * @param {number} min - Borne minimale
 * @param {number} max - Borne maximale
 * @returns {number} Valeur contrainte entre min et max
 *
 * @example
 * ```ts
 * clamp(5, 0, 10)  // retourne 5
 * clamp(-1, 0, 10) // retourne 0
 * clamp(15, 0, 10) // retourne 10
 * ```
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calcule la distance euclidienne entre deux points
 *
 * @param {Object} a - Premier point
 * @param {number} a.x - Coordonnée X du premier point
 * @param {number} a.y - Coordonnée Y du premier point
 * @param {Object} b - Second point
 * @param {number} b.x - Coordonnée X du second point
 * @param {number} b.y - Coordonnée Y du second point
 * @returns {number} Distance entre les deux points
 *
 * @example
 * ```ts
 * distance({ x: 0, y: 0 }, { x: 3, y: 4 }) // retourne 5
 * ```
 */
export function distance(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Convertit un point du canevas en coordonnées normalisées (0-1)
 *
 * @param {Object} stagePoint - Point en coordonnées du canevas
 * @param {number} stagePoint.x - Coordonnée X en pixels
 * @param {number} stagePoint.y - Coordonnée Y en pixels
 * @param {number} stageWidth - Largeur du canevas en pixels
 * @param {number} stageHeight - Hauteur du canevas en pixels
 * @returns {NormalizedPoint} Point avec coordonnées normalisées entre 0 et 1
 *
 * @example
 * ```ts
 * normalizedPointFromStage({ x: 100, y: 50 }, 200, 100)
 * // retourne { x: 0.5, y: 0.5 }
 * ```
 *
 * @throws {never} Ne lance jamais d'erreur grâce à la sécurisation des divisions
 */
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

/**
 * Convertit un point normalisé en coordonnées du canevas
 *
 * @param {NormalizedPoint} point - Point avec coordonnées normalisées (0-1)
 * @param {number} stageWidth - Largeur du canevas en pixels
 * @param {number} stageHeight - Hauteur du canevas en pixels
 * @returns {Object} Point en coordonnées du canevas
 * @returns {number} returns.x - Coordonnée X en pixels
 * @returns {number} returns.y - Coordonnée Y en pixels
 *
 * @example
 * ```ts
 * stagePointFromNormalized({ x: 0.5, y: 0.5 }, 200, 100)
 * // retourne { x: 100, y: 50 }
 * ```
 */
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

/**
 * Calcule les limites d'un polygone à partir de ses points
 *
 * @param {NormalizedPoint[]} points - Liste des points normalisés du polygone
 * @returns {Object} Limites et dimensions du polygone
 * @returns {number} returns.minX - X minimum
 * @returns {number} returns.maxX - X maximum
 * @returns {number} returns.minY - Y minimum
 * @returns {number} returns.maxY - Y maximum
 * @returns {number} returns.width - Largeur (maxX - minX)
 * @returns {number} returns.height - Hauteur (maxY - minY)
 *
 * @example
 * ```ts
 * const bounds = getPolygonBounds([
 *   { x: 0, y: 0 },
 *   { x: 1, y: 0 },
 *   { x: 0.5, y: 1 }
 * ]);
 * // retourne { minX: 0, maxX: 1, minY: 0, maxY: 1, width: 1, height: 1 }
 * ```
 */
export function getPolygonBounds(points: NormalizedPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Calcule le centre géométrique (centroïde) d'un polygone
 *
 * Le centre est calculé comme le point médian du rectangle englobant.
 * Pour un polygone vide, retourne l'origine (0,0).
 *
 * @param {NormalizedPoint[]} points - Liste des points normalisés du polygone
 * @returns {NormalizedPoint} Coordonnées normalisées du centre
 *
 * @example
 * ```ts
 * const centroid = getPolygonCentroid([
 *   { x: 0, y: 0 },
 *   { x: 1, y: 0 },
 *   { x: 0.5, y: 1 }
 * ]);
 * // retourne { x: 0.5, y: 0.5 }
 * ```
 */
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
