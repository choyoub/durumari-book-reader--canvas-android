import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
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

function db() {
  dbPromise ??= SQLite.openDatabaseAsync("durumari.db");
  return dbPromise;
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
      FOREIGN KEY(documentId) REFERENCES documents(documentId) ON DELETE CASCADE
    );
  `);
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
}

export async function upsertDocuments(documents: DocumentRecord[]) {
  if (!documents.length) return;
  const database = await db();
  await database.withTransactionAsync(async () => {
    for (const document of documents) {
      await database.runAsync(
        `INSERT OR REPLACE INTO documents
          (documentId, folderId, sourceUri, archiveEntryPath, title, kind, fileSize, modifiedAt, contentHash, text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    }
  });
}

export async function replaceFolderDocuments(folder: FolderRecord, documents: DocumentRecord[]) {
  const database = await db();
  await database.withTransactionAsync(async () => {
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
    const existing = await database.getAllAsync<{ documentId: string }>(
      "SELECT documentId FROM documents WHERE folderId = ?",
      folder.folderId,
    );
    const nextIds = new Set(documents.map((document) => document.documentId));
    for (const row of existing) {
      if (nextIds.has(row.documentId)) continue;
      await database.runAsync("DELETE FROM bookmarks WHERE documentId = ?", row.documentId);
      await database.runAsync("DELETE FROM readings WHERE documentId = ?", row.documentId);
      await database.runAsync("DELETE FROM documents WHERE documentId = ?", row.documentId);
    }
    for (const document of documents) {
      await database.runAsync(
        `INSERT OR REPLACE INTO documents
          (documentId, folderId, sourceUri, archiveEntryPath, title, kind, fileSize, modifiedAt, contentHash, text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    }
  });
}

export async function listFolders(): Promise<FolderRecord[]> {
  const database = await db();
  return database.getAllAsync<FolderRecord>("SELECT * FROM folders ORDER BY createdAt ASC");
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const database = await db();
  return database.getAllAsync<DocumentRecord>("SELECT * FROM documents ORDER BY modifiedAt DESC");
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
  const database = await db();
  await database.runAsync(
    `INSERT OR REPLACE INTO readings
      (documentId, lastPage, totalPages, progress, openedAt, completed, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    reading.documentId,
    reading.lastPage,
    reading.totalPages,
    reading.progress,
    reading.openedAt,
    reading.completed ? 1 : 0,
    reading.completedAt ?? null,
  );
}

export async function toggleBookmark(bookmark: BookmarkRecord) {
  const database = await db();
  const existing = await database.getFirstAsync<{ bookmarkId: string }>(
    "SELECT bookmarkId FROM bookmarks WHERE documentId = ? AND page = ?",
    bookmark.documentId,
    bookmark.page,
  );
  if (existing) {
    await database.runAsync("DELETE FROM bookmarks WHERE bookmarkId = ?", existing.bookmarkId);
    return false;
  }
  await database.runAsync(
    `INSERT INTO bookmarks
      (bookmarkId, documentId, page, totalPages, progress, preview, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    bookmark.bookmarkId,
    bookmark.documentId,
    bookmark.page,
    bookmark.totalPages,
    bookmark.progress,
    bookmark.preview,
    bookmark.createdAt,
  );
  return true;
}

export async function removeFolder(folderId: string) {
  const database = await db();
  await database.withTransactionAsync(async () => {
    const docs = await database.getAllAsync<{ documentId: string }>(
      "SELECT documentId FROM documents WHERE folderId = ?",
      folderId,
    );
    for (const doc of docs) {
      await database.runAsync("DELETE FROM bookmarks WHERE documentId = ?", doc.documentId);
      await database.runAsync("DELETE FROM readings WHERE documentId = ?", doc.documentId);
    }
    await database.runAsync("DELETE FROM documents WHERE folderId = ?", folderId);
    await database.runAsync("DELETE FROM folders WHERE folderId = ?", folderId);
  });
}

export async function clearFolders() {
  const database = await db();
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM bookmarks");
    await database.runAsync("DELETE FROM readings");
    await database.runAsync("DELETE FROM documents");
    await database.runAsync("DELETE FROM folders");
  });
}
