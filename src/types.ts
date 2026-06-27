export type BookKind = "txt" | "epub" | "zip" | "gz";
export type ReadingStatus = "unread" | "reading" | "completed";
export type ThemeName = "light" | "dark" | "paper" | "chalk";

export interface SortConfig {
  column: string;
  direction: "asc" | "desc" | "none";
}

export interface ReaderSettings {
  activeFolderId: string | null;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  lineHeight: number;
  letterSpacing: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingLinked: boolean;
  pageTurnTouch: boolean;
  pageTurnSwipe: boolean;
  pageTurnVolume: boolean;
  volumeKeyPaging: boolean;
  pageTurnFeedback: "none" | "vibration" | "sound";
  pageTurnStyle: "none" | "curl" | "slide";
  hideCompleted: boolean;
  theme: ThemeName;
  librarySort: SortConfig;
  historySort: SortConfig;
  bookmarksSort: SortConfig;
}

export interface FolderRecord {
  folderId: string;
  treeUri: string;
  displayName: string;
  createdAt: number;
  lastSyncedAt?: number;
  permissionStatus: "granted" | "required" | "failed";
}

export interface DocumentRecord {
  documentId: string;
  folderId: string;
  sourceUri: string;
  archiveEntryPath?: string;
  title: string;
  kind: BookKind;
  fileSize: number;
  modifiedAt: number;
  contentHash: string;
  text?: string;
  toc?: { label: string; href: string; charOffset: number }[];
}

export interface ReadingRecord {
  documentId: string;
  lastPage: number;
  totalPages: number;
  progress: number;
  openedAt: number;
  completed: boolean;
  completedAt?: number;
}



export function readingStatus(reading?: ReadingRecord): ReadingStatus {
  if (!reading || reading.lastPage <= 1) return "unread";
  if (reading.completed) return "completed";
  if (reading.lastPage >= reading.totalPages && reading.totalPages > 1) return "completed";
  return "reading";
}

export interface BookmarkRecord {
  bookmarkId: string;
  documentId: string;
  page: number;
  totalPages: number;
  progress: number;
  preview: string;
  createdAt: number;
}

export interface LibraryRow extends DocumentRecord {
  folderName: string;
  reading?: ReadingRecord;
}
