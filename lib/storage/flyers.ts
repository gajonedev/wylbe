import { del, get, keys, set } from "idb-keyval";

import type { FlyerLayout, FlyerLayoutSummary } from "@/lib/types";

type SerializedFlyerLayout = Omit<FlyerLayout, "flyerBlob"> & {
  flyerBlob: string;
};

const STORE_PREFIX = "flyer-layout";
const METADATA_KEY = "flyer-metadata-index";

function getLayoutKey(id: string) {
  return `${STORE_PREFIX}:${id}`;
}

function hasIndexedDB() {
  try {
    return typeof indexedDB !== "undefined";
  } catch (error) {
    console.warn("IndexedDB unavailable", error);
    return false;
  }
}

async function readMetadataIndex(): Promise<
  Record<string, FlyerLayoutSummary>
> {
  if (!hasIndexedDB()) {
    const raw = window.localStorage.getItem(METADATA_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FlyerLayoutSummary>) : {};
  }
  const metadata = await get<Record<string, FlyerLayoutSummary>>(METADATA_KEY);
  return metadata ?? {};
}

async function writeMetadataIndex(index: Record<string, FlyerLayoutSummary>) {
  if (!hasIndexedDB()) {
    window.localStorage.setItem(METADATA_KEY, JSON.stringify(index));
    return;
  }
  await set(METADATA_KEY, index);
}

async function persistLayout(layout: FlyerLayout) {
  const key = getLayoutKey(layout.meta.id);
  if (!hasIndexedDB()) {
    const arrayBuffer = await layout.flyerBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const payload: SerializedFlyerLayout = {
      ...layout,
      flyerBlob: base64,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return;
  }
  await set(key, layout);
}

async function readLayout(id: string): Promise<FlyerLayout | null> {
  const key = getLayoutKey(id);
  if (!hasIndexedDB()) {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const serialized = JSON.parse(raw) as SerializedFlyerLayout;
    const byteString = atob(serialized.flyerBlob);
    const buffer = new ArrayBuffer(byteString.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < byteString.length; i++) {
      view[i] = byteString.charCodeAt(i);
    }
    return {
      ...serialized,
      flyerBlob: new Blob([buffer], { type: "image/png" }),
    };
  }
  const data = await get<FlyerLayout>(key);
  return data ?? null;
}

async function removeLayout(id: string) {
  const key = getLayoutKey(id);
  if (!hasIndexedDB()) {
    window.localStorage.removeItem(key);
    return;
  }
  await del(key);
}

export async function saveFlyerLayout(layout: FlyerLayout) {
  const metadataIndex = await readMetadataIndex();
  metadataIndex[layout.meta.id] = {
    id: layout.meta.id,
    name: layout.meta.name,
    fileName: layout.meta.fileName,
    width: layout.meta.width,
    height: layout.meta.height,
    createdAt: layout.meta.createdAt,
    updatedAt: layout.meta.updatedAt,
    hasPlacements: Boolean(layout.placements?.length),
  };

  await persistLayout(layout);
  await writeMetadataIndex(metadataIndex);
}

export async function loadFlyerLayout(id: string) {
  return readLayout(id);
}

export async function listFlyerLayouts(): Promise<FlyerLayoutSummary[]> {
  const metadataIndex = await readMetadataIndex();
  return Object.values(metadataIndex).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function deleteFlyerLayout(id: string) {
  const metadataIndex = await readMetadataIndex();
  delete metadataIndex[id];
  await removeLayout(id);
  await writeMetadataIndex(metadataIndex);
}

export async function flyerExists(id: string) {
  const metadataIndex = await readMetadataIndex();
  return Boolean(metadataIndex[id]);
}

export async function clearAllFlyers() {
  const metadataIndex = await readMetadataIndex();
  await writeMetadataIndex({});
  if (!hasIndexedDB()) {
    Object.keys(metadataIndex).forEach((id) =>
      window.localStorage.removeItem(getLayoutKey(id))
    );
    return;
  }
  const allKeys = await keys();
  await Promise.all(
    allKeys
      .filter(
        (key): key is string =>
          typeof key === "string" && key.startsWith(STORE_PREFIX)
      )
      .map((key) => del(key))
  );
}
