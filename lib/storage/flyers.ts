import { AppwriteException, Models, Query } from "appwrite";

import {
  appwriteDatabases,
  appwriteStorage,
  ensureAppwriteSession,
} from "@/lib/appwrite";
import type {
  FlyerLayout,
  FlyerLayoutSummary,
  Placement,
  Zone,
} from "@/lib/types";

const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const flyersCollectionId =
  process.env.NEXT_PUBLIC_APPWRITE_FLYERS_COLLECTION_ID!;
const flyerBucketId = process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID!;

type FlyerDocument = Models.Document & {
  name: string;
  fileName: string;
  width: number;
  height: number;
  flyerFileId: string;
  zones?: Zone[] | string | null;
  placements?: Placement[];
};

function assertRemoteStorageConfig() {
  if (!databaseId || !flyersCollectionId || !flyerBucketId) {
    throw new Error(
      "Appwrite storage misconfigured: ensure NEXT_PUBLIC_APPWRITE_DATABASE_ID, NEXT_PUBLIC_APPWRITE_FLYERS_COLLECTION_ID and NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID are defined"
    );
  }
}

async function ensureRemoteReady() {
  assertRemoteStorageConfig();
  await ensureAppwriteSession();
}

function toFlyerSummary(document: FlyerDocument): FlyerLayoutSummary {
  return {
    id: document.$id,
    name: document.name,
    fileName: document.fileName,
    width: document.width,
    height: document.height,
    createdAt: document.$createdAt,
    updatedAt: document.$updatedAt,
    hasPlacements: Boolean(document.placements?.length),
  };
}

type ZoneLike = {
  id?: unknown;
  name?: unknown;
  points?: unknown;
};

type PointLike = {
  x?: unknown;
  y?: unknown;
};

function cloneZones(zones: ZoneLike[]): Zone[] {
  return zones
    .filter(
      (
        zone
      ): zone is ZoneLike & {
        id: string;
        name: string;
        points: unknown;
      } => typeof zone?.id === "string" && typeof zone?.name === "string"
    )
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      points: Array.isArray(zone.points)
        ? zone.points
            .map((point) => {
              if (
                point &&
                typeof (point as PointLike).x !== "undefined" &&
                typeof (point as PointLike).y !== "undefined"
              ) {
                const x = Number((point as PointLike).x);
                const y = Number((point as PointLike).y);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                  return { x, y };
                }
              }
              return null;
            })
            .filter(
              (point): point is { x: number; y: number } => point !== null
            )
        : [],
    }));
}

function serializeZones(zones: Zone[]): string {
  return JSON.stringify(cloneZones(zones));
}

function parseDocumentZones(value: FlyerDocument["zones"]): Zone[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return cloneZones(value as ZoneLike[]);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return cloneZones(parsed as ZoneLike[]);
      }
    } catch (error) {
      console.warn("Failed to parse zones JSON from Appwrite document", error);
    }
  }

  return [];
}

function asFlyerDocument(document: Models.Document): FlyerDocument {
  return document as unknown as FlyerDocument;
}

async function upsertFlyerFile(flyerId: string, blob: Blob, fileName: string) {
  assertRemoteStorageConfig();

  const file = new File([blob], fileName, {
    type: blob.type || "image/png",
  });

  try {
    await appwriteStorage.createFile(flyerBucketId!, flyerId, file);
    return flyerId;
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      typeof error.code === "number" &&
      error.code === 409
    ) {
      await appwriteStorage.deleteFile(flyerBucketId!, flyerId).catch(() => {
        /* ignore */
      });
      await appwriteStorage.createFile(flyerBucketId!, flyerId, file);
      return flyerId;
    }
    throw error;
  }
}

async function fetchFlyerBlob(fileId: string): Promise<Blob> {
  assertRemoteStorageConfig();

  const url = await appwriteStorage.getFileView(flyerBucketId!, fileId);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(
      `Unable to download flyer image (status ${response.status})`
    );
  }
  return await response.blob();
}

export async function saveFlyerLayout(layout: FlyerLayout) {
  await ensureRemoteReady();

  const flyerId = layout.meta.id;
  const fileId = await upsertFlyerFile(
    flyerId,
    layout.flyerBlob,
    layout.meta.fileName
  );

  const documentPayload = {
    name: layout.meta.name,
    fileName: layout.meta.fileName,
    width: layout.meta.width,
    height: layout.meta.height,
    flyerFileId: fileId,
    zones: serializeZones(layout.zones),
  } satisfies Record<string, unknown>;

  try {
    await appwriteDatabases.updateDocument(
      databaseId!,
      flyersCollectionId!,
      flyerId,
      documentPayload
    );
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      typeof error.code === "number" &&
      error.code === 404
    ) {
      await appwriteDatabases.createDocument(
        databaseId!,
        flyersCollectionId!,
        flyerId,
        documentPayload
      );
      return;
    }
    throw error;
  }
}

export async function loadFlyerLayout(id: string): Promise<FlyerLayout | null> {
  await ensureRemoteReady();

  try {
    console.log("Loading flyer layout", { id });
    const document = asFlyerDocument(
      await appwriteDatabases.getDocument(databaseId!, flyersCollectionId!, id)
    );
    console.log("Loaded flyer document", document);

    console.log("Loading flyer blob", document.flyerFileId);
    const flyerBlob = await fetchFlyerBlob(document.flyerFileId);
    console.log("Loaded flyer blob", flyerBlob);

    return {
      meta: {
        id: document.$id,
        name: document.name,
        fileName: document.fileName,
        width: document.width,
        height: document.height,
        createdAt: document.$createdAt,
        updatedAt: document.$updatedAt,
      },
      flyerBlob,
      zones: parseDocumentZones(document.zones),
      placements: Array.isArray(document.placements) ? document.placements : [],
    };
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      typeof error.code === "number" &&
      error.code === 404
    ) {
      return null;
    }
    throw error;
  }
}

export async function listFlyerLayouts(): Promise<FlyerLayoutSummary[]> {
  await ensureRemoteReady();

  const result = await appwriteDatabases.listDocuments(
    databaseId!,
    flyersCollectionId!,
    [Query.orderDesc("$updatedAt")]
  );

  return result.documents.map((document) =>
    toFlyerSummary(asFlyerDocument(document))
  );
}

export async function deleteFlyerLayout(id: string) {
  await ensureRemoteReady();

  try {
    const document = asFlyerDocument(
      await appwriteDatabases.getDocument(databaseId!, flyersCollectionId!, id)
    );

    await Promise.all([
      appwriteDatabases.deleteDocument(databaseId!, flyersCollectionId!, id),
      appwriteStorage
        .deleteFile(flyerBucketId!, document.flyerFileId)
        .catch(() => {
          /* ignore missing file */
        }),
    ]);
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      typeof error.code === "number" &&
      error.code === 404
    ) {
      return;
    }
    throw error;
  }
}

export async function flyerExists(id: string) {
  await ensureRemoteReady();

  try {
    await appwriteDatabases.getDocument(databaseId!, flyersCollectionId!, id);
    return true;
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      typeof error.code === "number" &&
      error.code === 404
    ) {
      return false;
    }
    throw error;
  }
}

export async function clearAllFlyers() {
  await ensureRemoteReady();

  const documents = await appwriteDatabases.listDocuments(
    databaseId!,
    flyersCollectionId!,
    [Query.limit(100)]
  );

  await Promise.all(
    documents.documents.map(async (document) => {
      const flyerDoc = asFlyerDocument(document);
      await Promise.all([
        appwriteDatabases.deleteDocument(
          databaseId!,
          flyersCollectionId!,
          flyerDoc.$id
        ),
        appwriteStorage
          .deleteFile(flyerBucketId!, flyerDoc.flyerFileId)
          .catch(() => {
            /* ignore */
          }),
      ]);
    })
  );
}
