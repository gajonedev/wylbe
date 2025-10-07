export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface Zone {
  id: string;
  name: string;
  points: NormalizedPoint[];
}

export interface FlyerImage {
  url: string;
  width: number;
  height: number;
  fileName: string;
}

export interface FlyerMetadata {
  id: string;
  name: string;
  fileName: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface Placement {
  zoneId: string;
  url: string;
  fileName: string;
  imageWidth: number;
  imageHeight: number;
  position: NormalizedPoint;
  scale: number;
  rotation: number;
}

export interface FlyerLayout {
  meta: FlyerMetadata;
  flyerBlob: Blob;
  zones: Zone[];
  placements?: Placement[];
}

export interface FlyerLayoutSummary {
  id: string;
  name: string;
  fileName: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  hasPlacements: boolean;
}
