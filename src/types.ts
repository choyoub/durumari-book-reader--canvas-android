export type BookKind = "txt" | "epub" | "zip" | "gz";
export type ReadingStatus = "unread" | "reading" | "completed";
export type ThemeName = "paper" | "light" | "dark";

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface ReaderSettings {
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
