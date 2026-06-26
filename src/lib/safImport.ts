import { AppState, Platform } from "react-native";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import type { BookKind, DocumentRecord, FolderRecord } from "../types";
import { documentFromBytes } from "./documentImport";

const { StorageAccessFramework } = FileSystem;

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

async function readSafBytes(uri: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function scanSafFolder(folder: FolderRecord): Promise<DocumentRecord[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folder.treeUri);
  const files = uris
    .map((uri) => ({ uri, name: documentName(uri) }))
    .filter((file) => extension(file.name));
  const documents: DocumentRecord[] = [];
  for (const file of files) {
    const bytes = await readSafBytes(file.uri);
    documents.push(await documentFromBytes({
      uri: file.uri,
      name: file.name,
      folderId: folder.folderId,
      modifiedAt: Date.now(),
      bytes,
    }));
  }
  return documents;
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

export async function rescanSafFolders(folders: FolderRecord[]) {
  if (Platform.OS !== "android") return [];
  const all: { folder: FolderRecord; documents: DocumentRecord[] }[] = [];
  for (const folder of folders.filter((item) => item.treeUri.startsWith("content://"))) {
    all.push({
      folder: { ...folder, lastSyncedAt: Date.now(), permissionStatus: "granted" },
      documents: await scanSafFolder(folder),
    });
  }
  return all;
}

export function subscribeForegroundRescan(callback: () => void) {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") callback();
  });
  return () => subscription.remove();
}
