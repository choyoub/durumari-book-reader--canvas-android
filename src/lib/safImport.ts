import { AppState, Platform } from "react-native";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import type { BookKind, DocumentRecord, FolderRecord } from "../types";

const { StorageAccessFramework } = FileSystem;

export interface SafFolderScanProgress {
  folderIndex: number;
  totalFolders: number;
  folderName: string;
  completedFiles: number;
  totalFiles: number;
  progress: number;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function documentName(uri: string) {
  const decoded = safeDecode(uri);
  const marker = "/document/";
  const documentId = decoded.includes(marker) ? decoded.slice(decoded.lastIndexOf(marker) + marker.length) : decoded;
  return documentId.split("/").filter(Boolean).pop() || "이름 없는 파일";
}

function directoryDisplayInfo(uri: string) {
  const decoded = safeDecode(uri);
  const treeMarker = "/tree/";
  const treeId = decoded.includes(treeMarker)
    ? decoded.slice(decoded.lastIndexOf(treeMarker) + treeMarker.length).split("/document/")[0]
    : decoded;
  const separator = treeId.indexOf(":");
  const volume = separator >= 0 ? treeId.slice(0, separator) : "";
  const relativePath = separator >= 0 ? treeId.slice(separator + 1) : treeId;
  const parts = relativePath.split("/").filter(Boolean);
  const rootName = volume.toLowerCase() === "primary"
    ? "내부 저장소"
    : volume.toLowerCase() === "home"
      ? "문서"
      : volume
        ? `SD 카드 (${volume})`
        : "선택한 폴더";

  return {
    path: [rootName, ...parts].join("/"),
    name: parts.at(-1) || rootName,
  };
}

function extension(name: string): BookKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "epub" || ext === "zip" || ext === "gz") return ext;
  return null;
}

function stripExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function hashFromUri(uri: string, name: string): string {
  // Lightweight hash from URI + name for scan-only mode
  let hash = 2166136261;
  const str = uri + name;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `uri-${(hash >>> 0).toString(16)}`;
}

function normalizeModifiedAt(value?: number) {
  if (!value) return undefined;
  return value < 10000000000
    ? Math.round(value * 1000)
    : Math.round(value);
}

async function readFileMetadata(uri: string, fallbackModifiedAt: number) {
  let fileSize = 0;
  let modifiedAt = fallbackModifiedAt;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      fileSize = info.size ?? 0;
      modifiedAt = normalizeModifiedAt(info.modificationTime) ?? modifiedAt;
    }
  } catch {
    // Some SAF providers omit file metadata. Keep scanning with a stable fallback date.
  }
  return { fileSize, modifiedAt };
}

/**
 * Lightweight folder scan: only collects file metadata (URI, name, kind)
 * WITHOUT reading file contents. This prevents OOM for large folders.
 * Text extraction happens on-demand when a document is opened in the viewer.
 */
async function scanSafFolder(
  folder: FolderRecord,
  onProgress?: (completedFiles: number, totalFiles: number) => void,
): Promise<DocumentRecord[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folder.treeUri);
  const files = uris
    .map((uri) => ({ uri, name: documentName(uri) }))
    .filter((file) => extension(file.name));
  const documents: DocumentRecord[] = [];
  onProgress?.(0, files.length);

  const fallbackModifiedAt = folder.lastSyncedAt ?? folder.createdAt;
  const batchSize = 15;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchDocuments = await Promise.all(batch.map(async (file) => {
      const kind = extension(file.name)!;
      const contentHash = hashFromUri(file.uri, file.name);
      const metadata = await readFileMetadata(file.uri, fallbackModifiedAt);
      return {
        documentId: `${folder.folderId}:${file.name}:${contentHash}`,
        folderId: folder.folderId,
        sourceUri: file.uri,
        title: stripExtension(file.name),
        kind,
        fileSize: metadata.fileSize,
        modifiedAt: metadata.modifiedAt,
        contentHash,
      };
    }));
    documents.push(...batchDocuments);
    onProgress?.(Math.min(files.length, i + batch.length), files.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return documents;
}

/**
 * Read file bytes from a SAF URI. Uses Buffer.from directly
 * to avoid the OOM-prone atob + manual Uint8Array loop.
 */
export async function readSafBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export async function chooseSafFolder(): Promise<{ folder: FolderRecord; documents: DocumentRecord[] } | null> {
  if (Platform.OS !== "android") {
    throw new Error("SAF 폴더 등록은 Android에서만 사용할 수 있습니다.");
  }
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return null;
  const display = directoryDisplayInfo(permissions.directoryUri);
  const now = Date.now();
  const folder: FolderRecord = {
    folderId: `saf-${permissions.directoryUri}`,
    treeUri: permissions.directoryUri,
    displayName: display.name,
    createdAt: now,
    lastSyncedAt: now,
    permissionStatus: "granted",
  };
  return { folder, documents: await scanSafFolder(folder) };
}

export async function rescanSafFolders(
  folders: FolderRecord[],
  onProgress?: (progress: SafFolderScanProgress) => void,
) {
  if (Platform.OS !== "android") return [];
  const all: { folder: FolderRecord; documents: DocumentRecord[] }[] = [];
  const syncableFolders = folders.filter((item) => item.treeUri.startsWith("content://"));
  for (let folderIndex = 0; folderIndex < syncableFolders.length; folderIndex += 1) {
    const folder = syncableFolders[folderIndex];
    const reportProgress = (completedFiles: number, totalFiles: number) => {
      const fileProgress = totalFiles > 0 ? completedFiles / totalFiles : (completedFiles > 0 ? 1 : 0);
      onProgress?.({
        folderIndex,
        totalFolders: syncableFolders.length,
        folderName: folder.displayName,
        completedFiles,
        totalFiles,
        progress: syncableFolders.length
          ? (folderIndex + fileProgress) / syncableFolders.length
          : 1,
      });
    };

    reportProgress(0, 0);
    try {
      const documents = await scanSafFolder(folder, reportProgress);
      all.push({
        folder: { ...folder, lastSyncedAt: Date.now(), permissionStatus: "granted" },
        documents,
      });
      reportProgress(Math.max(1, documents.length), documents.length);
    } catch (error) {
      // Permission revoked or folder deleted - mark as required
      all.push({
        folder: { ...folder, lastSyncedAt: Date.now(), permissionStatus: "required" },
        documents: [],
      });
      reportProgress(1, 1);
    }
  }
  return all;
}

export function subscribeForegroundRescan(callback: () => void) {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") callback();
  });
  return () => subscription.remove();
}
