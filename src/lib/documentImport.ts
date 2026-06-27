import { Buffer } from "buffer";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import iconv from "iconv-lite";
import JSZip from "jszip";
import { ungzip } from "pako";
import type { BookKind, DocumentRecord, FolderRecord } from "../types";

const ACCEPTED = [
  "text/plain",
  "application/epub+zip",
  "application/zip",
  "application/gzip",
  "application/x-gzip",
  "*/*",
];

function extension(name: string): BookKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "epub" || ext === "zip" || ext === "gz") return ext;
  return null;
}

function stripExtension(name: string) {
  return name.replace(/\.(txt|epub|zip|gz)$/i, "");
}

function decodeText(bytes: Uint8Array, forceEncoding?: string) {
  if (forceEncoding) {
    try {
      if (forceEncoding === "utf8") return Buffer.from(bytes).toString("utf8");
      return iconv.decode(Buffer.from(bytes), forceEncoding);
    } catch {
      // Ignore and fallback to auto-detection
    }
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return Buffer.from(bytes.slice(3)).toString("utf8");
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return iconv.decode(Buffer.from(bytes.slice(2)), "utf16-le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return iconv.decode(Buffer.from(bytes.slice(2)), "utf16-be");

  for (const encoding of ["utf8", "euc-kr", "cp949"]) {
    try {
      const text = iconv.decode(Buffer.from(bytes), encoding);
      if (text && !text.includes("\uFFFD")) return text;
    } catch {
      // Try the next encoding.
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function hashBytes(bytes: Uint8Array) {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return `${bytes.length}-${(hash >>> 0).toString(16)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index + 1);
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") throw new Error("경로 탐색 항목이 있는 압축 파일은 열 수 없습니다.");
    parts.push(part);
  }
  return parts.join("/");
}

function stripXml(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${escapeRegExp(name)}=["']([^"']+)["']`, "i"));
  return match?.[1];
}

async function textFromEpub(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const containerEntry = zip.file("META-INF/container.xml");
  if (!containerEntry) throw new Error("EPUB container.xml을 찾지 못했습니다.");
  const container = await containerEntry.async("text");
  const rootfile = container.match(/full-path=["']([^"']+)["']/i)?.[1];
  if (!rootfile) throw new Error("EPUB 패키지 경로를 찾지 못했습니다.");
  const opfEntry = zip.file(rootfile);
  if (!opfEntry) throw new Error("EPUB OPF 파일을 찾지 못했습니다.");
  const opf = await opfEntry.async("text");
  const base = dirname(rootfile);

  const manifest = new Map<string, { href: string; mediaType: string }>();
  let hasMedia = false;
  let hasScript = false;
  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tag = match[0];
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    const mediaType = attr(tag, "media-type") ?? "";
    if (id && href) manifest.set(id, { href: normalizeZipPath(base + href), mediaType });
    if (mediaType.includes("audio") || mediaType.includes("video")) hasMedia = true;
    if (mediaType.includes("javascript") || mediaType.includes("script")) hasScript = true;
  }

  // DRM Check
  if (zip.file("META-INF/encryption.xml")) {
    throw new Error("DRM이 적용된 EPUB은 지원하지 않습니다.");
  }

  // Fixed Layout Check
  if (opf.includes("pre-paginated") || opf.includes("fixed-layout")) {
    throw new Error("고정 레이아웃 EPUB은 지원하지 않습니다.");
  }

  const spineIds = Array.from(opf.matchAll(/<itemref\b[^>]*>/gi))
    .map((match) => attr(match[0], "idref"))
    .filter((value): value is string => Boolean(value));
  if (!spineIds.length) throw new Error("EPUB spine 항목을 찾지 못했습니다.");

  const chapters: string[] = [];
  const hrefOffsets = new Map<string, number>();
  let currentOffset = 0;
  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item || !/(xhtml|html|xml)/i.test(item.mediaType + item.href)) continue;
    const entry = zip.file(item.href);
    if (!entry) continue;
    const html = await entry.async("text");
    const text = stripXml(html);
    if (text) {
      hrefOffsets.set(item.href, currentOffset);
      chapters.push(text);
      currentOffset += text.length + 2; // +2 for "\n\n" joining
    }
  }
  if (!chapters.length) {
    if (hasMedia || hasScript) {
      throw new Error("오디오/비디오 또는 스크립트 중심의 EPUB은 텍스트 뷰어에서 지원하지 않습니다.");
    }
    throw new Error("EPUB에서 읽을 수 있는 본문을 찾지 못했습니다.");
  }

  const toc: { label: string; href: string; charOffset: number }[] = [];
  const ncxItem = Array.from(manifest.values()).find((m) => m.mediaType === "application/x-dtbncx+xml");
  if (ncxItem && zip.file(ncxItem.href)) {
    const ncxText = await zip.file(ncxItem.href)!.async("text");
    for (const match of ncxText.matchAll(/<navPoint\b[^>]*>([\s\S]*?)<\/navPoint>/gi)) {
      const inner = match[1];
      const labelMatch = inner.match(/<text>([\s\S]*?)<\/text>/i);
      const contentMatch = inner.match(/<content\b[^>]*src=["']([^"']+)["']/i);
      if (labelMatch && contentMatch) {
        const label = labelMatch[1].replace(/<[^>]+>/g, "").trim();
        const src = contentMatch[1].split("#")[0];
        const href = normalizeZipPath(dirname(ncxItem.href) + "/" + src);
        if (hrefOffsets.has(href)) {
          toc.push({ label, href, charOffset: hrefOffsets.get(href)! });
        }
      }
    }
  }

  return { text: chapters.join("\n\n"), toc: toc.length ? toc : undefined };
}

async function readBytes(uri: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function documentFromBytes({
  uri,
  name,
  folderId,
  modifiedAt,
  bytes,
  forceEncoding,
}: {
  uri: string;
  name: string;
  folderId: string;
  modifiedAt: number;
  bytes: Uint8Array;
  forceEncoding?: string;
}): Promise<DocumentRecord> {
  const kind = extension(name);
  if (!kind) throw new Error("지원하지 않는 파일 형식입니다.");
  const fileSize = bytes.byteLength;
  const contentHash = hashBytes(bytes);
  return {
    documentId: `${folderId}:${name}:${fileSize}:${contentHash}`,
    folderId,
    sourceUri: uri,
    title: stripExtension(name),
    kind,
    fileSize,
    modifiedAt,
    contentHash,
    ...await extractText(kind, bytes, forceEncoding),
  };
}

export async function hydrateDocumentFromBytes(
  document: DocumentRecord,
  bytes: Uint8Array,
  forceEncoding?: string,
): Promise<DocumentRecord> {
  const parsed = await documentFromBytes({
    uri: document.sourceUri,
    name: `${document.title}.${document.kind}`,
    folderId: document.folderId,
    modifiedAt: document.modifiedAt,
    bytes,
    forceEncoding,
  });

  return {
    ...document,
    fileSize: parsed.fileSize,
    contentHash: parsed.contentHash,
    text: parsed.text,
    toc: parsed.toc,
  };
}

async function textFromZip(bytes: Uint8Array, forceEncoding?: string) {
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("압축 파일 한도(100MB)를 초과했습니다.");
  const zip = await JSZip.loadAsync(bytes);
  const allEntries = Object.values(zip.files);
  if (allEntries.length > 2000) throw new Error("압축 파일 항목 수 한도(2,000개)를 초과했습니다.");
  if (allEntries.some((entry) => entry.name.includes(".."))) {
    throw new Error("경로 탐색 항목이 있는 압축 파일은 열 수 없습니다.");
  }
  const entries = allEntries
    .filter((entry) => !entry.dir && /\.(txt|epub)$/i.test(entry.name))
    .slice(0, 2000)
    .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true }));
  if (!entries.length) throw new Error("압축 파일 안에 지원 문서가 없습니다.");
  const parts: string[] = [];
  let inflated = 0;
  for (const entry of entries) {
    const content = await entry.async("uint8array");
    inflated += content.byteLength;
    if (inflated > 500 * 1024 * 1024) throw new Error("압축 해제 한도(500MB)를 초과했습니다.");
    if (content.byteLength > bytes.byteLength * 100) throw new Error("압축률 한도를 초과했습니다.");
    if (/\.epub$/i.test(entry.name)) {
      parts.push(`\n\n${entry.name}\n\n${(await textFromEpub(content)).text}`);
      continue;
    }
    parts.push(entries.length > 1 ? `\n\n${entry.name}\n\n${decodeText(content, forceEncoding)}` : decodeText(content, forceEncoding));
  }
  return parts.join("\n");
}

async function extractText(kind: BookKind, bytes: Uint8Array, forceEncoding?: string): Promise<{ text: string; toc?: { label: string; href: string; charOffset: number }[] }> {
  if (kind === "txt") return { text: decodeText(bytes, forceEncoding) };
  if (kind === "gz") return { text: decodeText(ungzip(bytes), forceEncoding) };
  if (kind === "zip") return { text: await textFromZip(bytes, forceEncoding) };
  return textFromEpub(bytes);
}

export async function pickDocuments(): Promise<{ folder: FolderRecord; documents: DocumentRecord[] } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const now = Date.now();
  const folder: FolderRecord = {
    folderId: `imports-${now}`,
    treeUri: "expo-document-picker://imports",
    displayName: "가져온 문서",
    createdAt: now,
    lastSyncedAt: now,
    permissionStatus: "granted",
  };

  const documents: DocumentRecord[] = [];
  for (const asset of result.assets) {
    if (!extension(asset.name)) continue;
    const bytes = await readBytes(asset.uri);
    const modifiedAt = asset.lastModified ?? now;
    documents.push(await documentFromBytes({
      uri: asset.uri,
      name: asset.name,
      folderId: folder.folderId,
      modifiedAt,
      bytes,
    }));
  }

  return { folder, documents };
}
