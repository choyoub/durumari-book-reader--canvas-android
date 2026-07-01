import { Platform } from "react-native";
import type { BookKind, DocumentRecord, FolderRecord } from "../types";
import { replaceFolderDocuments } from "./store";

declare const process: { env?: Record<string, string | undefined> } | undefined;

type TestNovelManifestItem = {
  file: string;
  title?: string;
  modifiedAt?: number;
  size?: number;
};

const TEST_FOLDER_ID = "web-test-novels";
const TEST_FOLDER_PATH = "/test-novels";
const TEST_MANIFEST_PATH = `${TEST_FOLDER_PATH}/manifest.json`;
const TEST_SERVER_BASE_URL = typeof process !== "undefined"
  ? process.env?.EXPO_PUBLIC_TEST_NOVELS_BASE_URL
  : undefined;

function isEnabledByEnv() {
  return typeof process !== "undefined" && process.env?.EXPO_PUBLIC_TEST_MODE === "1";
}

export function isWebTestMode() {
  return Platform.OS === "web" && isEnabledByEnv();
}

function normalizeTestFile(file: string) {
  return file.replace(/^\/+/, "");
}

function extension(name: string): BookKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "epub" || ext === "zip" || ext === "gz") return ext;
  return null;
}

function stripExtension(name: string) {
  return name.replace(/\.(txt|epub|zip|gz)$/i, "");
}

function hashFromManifest(item: TestNovelManifestItem) {
  let hash = 2166136261;
  const value = `${item.file}:${item.size ?? 0}:${item.modifiedAt ?? 0}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `test-${(hash >>> 0).toString(16)}`;
}

function fileUrl(file: string) {
  if (TEST_SERVER_BASE_URL) {
    return `${TEST_SERVER_BASE_URL}/file?path=${encodeURIComponent(file)}`;
  }
  return `${TEST_FOLDER_PATH}/${file}`;
}

async function readManifest(): Promise<TestNovelManifestItem[]> {
  const manifestUrl = TEST_SERVER_BASE_URL ? `${TEST_SERVER_BASE_URL}/manifest.json` : TEST_MANIFEST_PATH;
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`테스트 문서 목록을 읽지 못했습니다. (${response.status})`);
  }
  const manifest = await response.json();
  if (!Array.isArray(manifest)) {
    throw new Error("테스트 문서 manifest 형식이 올바르지 않습니다.");
  }
  return manifest
    .filter((item): item is TestNovelManifestItem => (
      item
      && typeof item === "object"
      && typeof item.file === "string"
      && /\.(txt|epub|zip|gz)$/i.test(item.file)
    ))
    .map((item) => ({ ...item, file: normalizeTestFile(item.file) }));
}

export async function seedWebTestLibrary() {
  if (!isWebTestMode()) return null;

  const now = Date.now();
  const folder: FolderRecord = {
    folderId: TEST_FOLDER_ID,
    treeUri: TEST_SERVER_BASE_URL ?? TEST_FOLDER_PATH,
    displayName: "테스트 소설",
    createdAt: 1,
    lastSyncedAt: now,
    permissionStatus: "granted",
  };

  const manifest = await readManifest();
  const documents: DocumentRecord[] = [];
  for (const item of manifest) {
    const name = item.file.split("/").pop() ?? item.file;
    const kind = extension(name);
    if (!kind) continue;
    const contentHash = hashFromManifest(item);
    const fileSize = item.size ?? 0;
    const modifiedAt = item.modifiedAt ?? now;
    documents.push({
      documentId: `${TEST_FOLDER_ID}:${item.file}:${fileSize}:${contentHash}`,
      folderId: TEST_FOLDER_ID,
      sourceUri: fileUrl(item.file),
      title: item.title ?? stripExtension(name),
      kind,
      fileSize,
      modifiedAt,
      contentHash,
    });
  }

  await replaceFolderDocuments(folder, documents);
  return { folder, documents };
}

export async function readWebTestDocumentBytes(uri: string) {
  const isTestUri = uri.startsWith(`${TEST_FOLDER_PATH}/`) || (TEST_SERVER_BASE_URL ? uri.startsWith(TEST_SERVER_BASE_URL) : false);
  if (!isWebTestMode() || !isTestUri) return null;
  const response = await fetch(uri, { cache: "no-store" });
  if (!response.ok) throw new Error(`테스트 문서를 다시 읽지 못했습니다. (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
