import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type {
  BookmarkRecord,
  DocumentRecord,
  FolderRecord,
  ReaderSettings,
  ReadingRecord,
} from "../types";
import { defaultSettings } from "./settings";

const SETTINGS_KEY = "durumari.settings";
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function db() {
  dbPromise ??= SQLite.openDatabaseAsync("durumari.db");
  return dbPromise;
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function writeTransaction<T>(task: (transaction: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  return enqueueWrite(async () => {
    const database = await db();
    let result!: T;
    if (Platform.OS === "web") {
      await database.withTransactionAsync(async () => {
        result = await task(database);
      });
    } else {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        result = await task(transaction);
      });
    }
    return result;
  });
}

export async function initStore() {
  const database = await db();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS folders (
      folderId TEXT PRIMARY KEY NOT NULL,
      treeUri TEXT NOT NULL,
      displayName TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      lastSyncedAt INTEGER,
      permissionStatus TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      documentId TEXT PRIMARY KEY NOT NULL,
      folderId TEXT NOT NULL,
      sourceUri TEXT NOT NULL,
      archiveEntryPath TEXT,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      modifiedAt INTEGER NOT NULL,
      contentHash TEXT NOT NULL,
      text TEXT,
      FOREIGN KEY(folderId) REFERENCES folders(folderId) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS readings (
      documentId TEXT PRIMARY KEY NOT NULL,
      lastPage INTEGER NOT NULL,
      totalPages INTEGER NOT NULL,
      progress REAL NOT NULL,
      openedAt INTEGER NOT NULL,
      completed INTEGER NOT NULL,
      completedAt INTEGER,
      anchorOffset INTEGER,
      FOREIGN KEY(documentId) REFERENCES documents(documentId) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      bookmarkId TEXT PRIMARY KEY NOT NULL,
      documentId TEXT NOT NULL,
      page INTEGER NOT NULL,
      totalPages INTEGER NOT NULL,
      progress REAL NOT NULL,
      preview TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      anchorOffset INTEGER,
      FOREIGN KEY(documentId) REFERENCES documents(documentId) ON DELETE CASCADE
    );
  `);
  try { await database.execAsync("ALTER TABLE documents ADD COLUMN toc TEXT;"); } catch {}
  try { await database.execAsync("ALTER TABLE readings ADD COLUMN anchorOffset INTEGER;"); } catch {}
  try { await database.execAsync("ALTER TABLE bookmarks ADD COLUMN anchorOffset INTEGER;"); } catch {}
}

export async function loadSettings(): Promise<ReaderSettings> {
  const value = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!value) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(value) };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: ReaderSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function resetSettings() {
  await saveSettings(defaultSettings);
  return defaultSettings;
}

export async function upsertFolder(folder: FolderRecord) {
  await enqueueWrite(async () => {
    const database = await db();
    await database.runAsync(
      `INSERT OR REPLACE INTO folders
        (folderId, treeUri, displayName, createdAt, lastSyncedAt, permissionStatus)
        VALUES (?, ?, ?, ?, ?, ?)`,
      folder.folderId,
      folder.treeUri,
      folder.displayName,
      folder.createdAt,
      folder.lastSyncedAt ?? null,
      folder.permissionStatus,
    );
  });
}

export async function upsertDocuments(documents: DocumentRecord[]) {
  if (!documents.length) return;
  await writeTransaction(async (transaction) => {
    for (const document of documents) {
      await transaction.runAsync(
        `INSERT INTO documents
          (documentId, folderId, sourceUri, archiveEntryPath, title, kind, fileSize, modifiedAt, contentHash, text, toc)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(documentId) DO UPDATE SET
            folderId = excluded.folderId,
            sourceUri = excluded.sourceUri,
            archiveEntryPath = excluded.archiveEntryPath,
            title = excluded.title,
            kind = excluded.kind,
            fileSize = CASE WHEN excluded.fileSize > 0 THEN excluded.fileSize ELSE documents.fileSize END,
            modifiedAt = CASE WHEN excluded.modifiedAt > 0 THEN excluded.modifiedAt ELSE documents.modifiedAt END,
            contentHash = CASE WHEN excluded.text IS NOT NULL THEN excluded.contentHash ELSE documents.contentHash END,
            text = COALESCE(excluded.text, documents.text),
            toc = CASE WHEN excluded.text IS NOT NULL THEN excluded.toc ELSE documents.toc END`,
        document.documentId,
        document.folderId,
        document.sourceUri,
        document.archiveEntryPath ?? null,
        document.title,
        document.kind,
        document.fileSize,
        document.modifiedAt,
        document.contentHash,
        document.text ?? null,
        document.toc ? JSON.stringify(document.toc) : null,
      );
    }
  });
}

export async function replaceFolderDocuments(folder: FolderRecord, documents: DocumentRecord[]) {
  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      `INSERT OR REPLACE INTO folders
        (folderId, treeUri, displayName, createdAt, lastSyncedAt, permissionStatus)
        VALUES (?, ?, ?, ?, ?, ?)`,
      folder.folderId,
      folder.treeUri,
      folder.displayName,
      folder.createdAt,
      folder.lastSyncedAt ?? null,
      folder.permissionStatus,
    );
    if (folder.permissionStatus !== "granted") return;
    const existing = await transaction.getAllAsync<{
      documentId: string;
      contentHash: string;
      sourceUri: string;
      title: string;
      kind: string;
      fileSize: number;
      modifiedAt: number;
    }>(
      "SELECT documentId, contentHash, sourceUri, title, kind, fileSize, modifiedAt FROM documents WHERE folderId = ?",
      folder.folderId,
    );
    const nextIds = new Set(documents.map((document) => document.documentId));
    const existingIds = new Set(existing.map((document) => document.documentId));
    const existingById = new Map(existing.map((document) => [document.documentId, document]));
    for (const document of documents) {
      const current = existingById.get(document.documentId);
      if (
        current
        && current.contentHash === document.contentHash
        && current.sourceUri === document.sourceUri
        && current.title === document.title
        && current.kind === document.kind
        && (document.modifiedAt <= 0 || current.modifiedAt === document.modifiedAt)
        && (document.fileSize <= 0 || current.fileSize === document.fileSize)
      ) {
        continue;
      }
      await transaction.runAsync(
        `INSERT INTO documents
          (documentId, folderId, sourceUri, archiveEntryPath, title, kind, fileSize, modifiedAt, contentHash, text, toc)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(documentId) DO UPDATE SET
            folderId = excluded.folderId,
            sourceUri = excluded.sourceUri,
            archiveEntryPath = excluded.archiveEntryPath,
            title = excluded.title,
            kind = excluded.kind,
            fileSize = CASE WHEN excluded.fileSize > 0 THEN excluded.fileSize ELSE documents.fileSize END,
            modifiedAt = CASE WHEN excluded.modifiedAt > 0 THEN excluded.modifiedAt ELSE documents.modifiedAt END,
            contentHash = CASE WHEN excluded.text IS NOT NULL THEN excluded.contentHash ELSE documents.contentHash END,
            text = COALESCE(excluded.text, documents.text),
            toc = CASE WHEN excluded.text IS NOT NULL THEN excluded.toc ELSE documents.toc END`,
        document.documentId,
        document.folderId,
        document.sourceUri,
        document.archiveEntryPath ?? null,
        document.title,
        document.kind,
        document.fileSize,
        document.modifiedAt,
        document.contentHash,
        document.text ?? null,
        document.toc ? JSON.stringify(document.toc) : null,
      );
    }
    const existingByHash = new Map<string, typeof existing>();
    for (const item of existing) {
      const bucket = existingByHash.get(item.contentHash);
      if (bucket) bucket.push(item);
      else existingByHash.set(item.contentHash, [item]);
    }

    const migratedOldIds = new Set<string>();
    const usedHashes = new Set<string>();
    for (const document of documents) {
      if (existingIds.has(document.documentId) || usedHashes.has(document.contentHash)) continue;
      const match = existingByHash.get(document.contentHash)?.find((item) => (
        item.contentHash === document.contentHash
        && item.documentId !== document.documentId
        && !nextIds.has(item.documentId)
        && !migratedOldIds.has(item.documentId)
      ));
      if (!match) continue;
      await transaction.runAsync(
        `UPDATE documents
          SET text = COALESCE(documents.text, (SELECT text FROM documents WHERE documentId = ?)),
              toc = COALESCE(documents.toc, (SELECT toc FROM documents WHERE documentId = ?)),
              modifiedAt = CASE WHEN ? > 0 THEN ? ELSE documents.modifiedAt END,
              fileSize = CASE
                WHEN documents.fileSize > 0 THEN documents.fileSize
                ELSE COALESCE((SELECT fileSize FROM documents WHERE documentId = ?), documents.fileSize)
              END
          WHERE documentId = ?`,
        match.documentId,
        match.documentId,
        document.modifiedAt,
        document.modifiedAt,
        match.documentId,
        document.documentId,
      );
      await transaction.runAsync("UPDATE readings SET documentId = ? WHERE documentId = ?", document.documentId, match.documentId);
      await transaction.runAsync("UPDATE bookmarks SET documentId = ? WHERE documentId = ?", document.documentId, match.documentId);
      await transaction.runAsync("DELETE FROM documents WHERE documentId = ?", match.documentId);
      migratedOldIds.add(match.documentId);
      usedHashes.add(document.contentHash);
    }
    for (const row of existing) {
      if (nextIds.has(row.documentId) || migratedOldIds.has(row.documentId)) continue;
      await transaction.runAsync("DELETE FROM bookmarks WHERE documentId = ?", row.documentId);
      await transaction.runAsync("DELETE FROM readings WHERE documentId = ?", row.documentId);
      await transaction.runAsync("DELETE FROM documents WHERE documentId = ?", row.documentId);
    }
  });
}

export async function listFolders(): Promise<FolderRecord[]> {
  const database = await db();
  return database.getAllAsync<FolderRecord>("SELECT * FROM folders ORDER BY createdAt ASC");
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const database = await db();
  // Exclude text column to prevent OOM with large libraries
  const rows = await database.getAllAsync<any>(
    "SELECT documentId, folderId, sourceUri, archiveEntryPath, title, kind, fileSize, modifiedAt, contentHash, toc FROM documents ORDER BY modifiedAt DESC"
  );
  return rows.map((row) => ({
    ...row,
    toc: row.toc ? JSON.parse(row.toc) : undefined,
  }));
}

/** Load full document text on demand (when entering viewer) */
export async function getDocumentText(documentId: string): Promise<{ text?: string; toc?: any }> {
  const database = await db();
  const row = await database.getFirstAsync<{ text: string | null; toc: string | null }>(
    "SELECT text, toc FROM documents WHERE documentId = ?",
    documentId,
  );
  if (!row) return {};
  return {
    text: row.text ?? undefined,
    toc: row.toc ? JSON.parse(row.toc) : undefined,
  };
}

/** Update folder display name */
export async function updateFolderDisplayName(folderId: string, displayName: string) {
  await enqueueWrite(async () => {
    const database = await db();
    await database.runAsync(
      "UPDATE folders SET displayName = ? WHERE folderId = ?",
      displayName,
      folderId,
    );
  });
}

export async function listReadings(): Promise<ReadingRecord[]> {
  const database = await db();
  const rows = await database.getAllAsync<Omit<ReadingRecord, "completed"> & { completed: number }>("SELECT * FROM readings");
  return rows.map((row) => ({ ...row, completed: Boolean(row.completed) }));
}

export async function listBookmarks(): Promise<BookmarkRecord[]> {
  const database = await db();
  return database.getAllAsync<BookmarkRecord>("SELECT * FROM bookmarks ORDER BY createdAt DESC");
}

export async function saveReading(reading: ReadingRecord) {
  await enqueueWrite(async () => {
    const database = await db();
    await database.runAsync(
      `INSERT OR REPLACE INTO readings
        (documentId, lastPage, totalPages, progress, openedAt, completed, completedAt, anchorOffset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      reading.documentId,
      reading.lastPage,
      reading.totalPages,
      reading.progress,
      reading.openedAt,
      reading.completed ? 1 : 0,
      reading.completedAt ?? null,
      reading.anchorOffset ?? null,
    );
  });
}

export async function toggleBookmark(bookmark: BookmarkRecord) {
  return writeTransaction(async (transaction) => {
    const existing = bookmark.anchorOffset !== null && bookmark.anchorOffset !== undefined
      ? await transaction.getFirstAsync<{ bookmarkId: string }>(
        `SELECT bookmarkId FROM bookmarks
          WHERE documentId = ? AND (bookmarkId = ? OR anchorOffset = ? OR page = ?)
          LIMIT 1`,
        bookmark.documentId,
        bookmark.bookmarkId,
        bookmark.anchorOffset,
        bookmark.page,
      )
      : await transaction.getFirstAsync<{ bookmarkId: string }>(
        `SELECT bookmarkId FROM bookmarks
          WHERE documentId = ? AND (bookmarkId = ? OR page = ?)
          LIMIT 1`,
        bookmark.documentId,
        bookmark.bookmarkId,
        bookmark.page,
      );
    if (existing) {
      await transaction.runAsync("DELETE FROM bookmarks WHERE bookmarkId = ?", existing.bookmarkId);
      return false;
    }
    await transaction.runAsync(
      `INSERT INTO bookmarks
        (bookmarkId, documentId, page, totalPages, progress, preview, createdAt, anchorOffset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      bookmark.bookmarkId,
      bookmark.documentId,
      bookmark.page,
      bookmark.totalPages,
      bookmark.progress,
      bookmark.preview,
      bookmark.createdAt,
      bookmark.anchorOffset ?? null,
    );
    return true;
  });
}

export async function syncBookmarks(bookmarks: BookmarkRecord[]) {
  if (!bookmarks.length) return;
  await writeTransaction(async (transaction) => {
    for (const bookmark of bookmarks) {
      await transaction.runAsync(
        `UPDATE bookmarks
          SET page = ?,
              totalPages = ?,
              progress = ?,
              preview = ?,
              anchorOffset = ?
          WHERE bookmarkId = ?`,
        bookmark.page,
        bookmark.totalPages,
        bookmark.progress,
        bookmark.preview,
        bookmark.anchorOffset ?? null,
        bookmark.bookmarkId,
      );
    }
  });
}

export async function removeFolder(folderId: string) {
  await writeTransaction(async (transaction) => {
    const docs = await transaction.getAllAsync<{ documentId: string }>(
      "SELECT documentId FROM documents WHERE folderId = ?",
      folderId,
    );
    for (const doc of docs) {
      await transaction.runAsync("DELETE FROM bookmarks WHERE documentId = ?", doc.documentId);
      await transaction.runAsync("DELETE FROM readings WHERE documentId = ?", doc.documentId);
    }
    await transaction.runAsync("DELETE FROM documents WHERE folderId = ?", folderId);
    await transaction.runAsync("DELETE FROM folders WHERE folderId = ?", folderId);
  });
}

export async function clearFolders() {
  await writeTransaction(async (transaction) => {
    await transaction.runAsync("DELETE FROM bookmarks");
    await transaction.runAsync("DELETE FROM readings");
    await transaction.runAsync("DELETE FROM documents");
    await transaction.runAsync("DELETE FROM folders");
  });
}
