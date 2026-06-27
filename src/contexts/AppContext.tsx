import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { 
  FolderRecord, 
  DocumentRecord, 
  ReadingRecord, 
  BookmarkRecord, 
  ReaderSettings, 
  SortConfig 
} from '../types';
import { defaultSettings, resolveActiveFolderId } from '../lib/settings';
import { 
  listFolders, 
  listDocuments, 
  listReadings, 
  listBookmarks, 
  replaceFolderDocuments,
  saveSettings
} from '../lib/store';
import { rescanSafFolders } from '../lib/safImport';

export type TabName = 'library' | 'history' | 'bookmarks';

export interface FolderSyncProgress {
  phase: 'preparing' | 'scanning' | 'saving' | 'refreshing' | 'complete';
  progress: number;
  message: string;
}

type FolderSyncProgressListener = (progress: FolderSyncProgress) => void;

interface AppContextValue {
  settings: ReaderSettings;
  setSettings: React.Dispatch<React.SetStateAction<ReaderSettings>>;
  draftSettings: ReaderSettings;
  setDraftSettings: React.Dispatch<React.SetStateAction<ReaderSettings>>;

  folders: FolderRecord[];
  documents: DocumentRecord[];
  readings: ReadingRecord[];
  bookmarks: BookmarkRecord[];
  
  readingsById: Map<string, ReadingRecord>;
  foldersById: Map<string, FolderRecord>;

  activeFolderId: string | null;
  setActiveFolderId: (folderId: string | null) => void;
  
  activeDocument: DocumentRecord | null;
  setActiveDocument: React.Dispatch<React.SetStateAction<DocumentRecord | null>>;

  refresh: () => Promise<void>;
  rescanFolders: (onProgress?: FolderSyncProgressListener) => Promise<void>;
  updateSort: (target: TabName, column: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<ReaderSettings>(defaultSettings);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null);
  const rescanPromiseRef = useRef<Promise<void> | null>(null);
  const rescanProgressListenersRef = useRef(new Set<FolderSyncProgressListener>());
  const activeFolderId = settings.activeFolderId ?? null;

  const setActiveFolderId = useCallback((folderId: string | null) => {
    if ((settings.activeFolderId ?? null) === folderId) return;
    const nextSettings = { ...settings, activeFolderId: folderId };
    setSettings(nextSettings);
    setDraftSettings((current) => ({ ...current, activeFolderId: folderId }));
    void saveSettings(nextSettings);
  }, [settings]);

  useEffect(() => {
    if (!folders.length) return;
    const resolvedFolderId = resolveActiveFolderId(folders.map((folder) => folder.folderId), activeFolderId);
    if (resolvedFolderId !== activeFolderId) setActiveFolderId(resolvedFolderId);
  }, [activeFolderId, folders, setActiveFolderId]);

  const refresh = useCallback(async () => {
    const [folderRows, documentRows, readingRows, bookmarkRows] = await Promise.all([
      listFolders(),
      listDocuments(),
      listReadings(),
      listBookmarks(),
    ]);
    setFolders(folderRows);
    setDocuments(documentRows);
    setReadings(readingRows);
    setBookmarks(bookmarkRows);
  }, []);

  const rescanFoldersContext = useCallback(async (onProgress?: FolderSyncProgressListener) => {
    if (onProgress) rescanProgressListenersRef.current.add(onProgress);

    if (!rescanPromiseRef.current) {
      const report = (progress: FolderSyncProgress) => {
        rescanProgressListenersRef.current.forEach((listener) => listener(progress));
      };
      const task = (async () => {
        report({ phase: 'preparing', progress: 0, message: '로컬 폴더를 확인하는 중...' });
        const currentFolders = await listFolders();
        const rescanned = await rescanSafFolders(currentFolders, (scanProgress) => {
          const fileCount = scanProgress.totalFiles > 0
            ? ` ${scanProgress.completedFiles}/${scanProgress.totalFiles}`
            : '';
          report({
            phase: 'scanning',
            progress: scanProgress.progress * 0.78,
            message: `${scanProgress.folderName} 동기화 중...${fileCount}`,
          });
        });

        if (!rescanned.length) {
          report({ phase: 'scanning', progress: 0.78, message: '등록된 로컬 폴더를 확인했습니다.' });
        }

        for (let index = 0; index < rescanned.length; index += 1) {
          const item = rescanned[index];
          await replaceFolderDocuments(item.folder, item.documents);
          report({
            phase: 'saving',
            progress: 0.78 + ((index + 1) / rescanned.length) * 0.17,
            message: `문서 목록 저장 중... ${index + 1}/${rescanned.length}`,
          });
        }

        report({ phase: 'refreshing', progress: 0.97, message: '문서 목록을 정리하는 중...' });
        await refresh();
        report({ phase: 'complete', progress: 1, message: '문서 동기화 완료' });
      })();
      let handledTask: Promise<void>;
      handledTask = task
        .catch((error) => {
          report({ phase: 'complete', progress: 1, message: '문서 동기화를 완료하지 못했습니다.' });
          Alert.alert("동기화 실패", error instanceof Error ? error.message : "폴더를 다시 스캔하지 못했습니다.");
        })
        .finally(() => {
          if (rescanPromiseRef.current === handledTask) rescanPromiseRef.current = null;
        });
      rescanPromiseRef.current = handledTask;
    }

    try {
      await rescanPromiseRef.current;
    } finally {
      if (onProgress) rescanProgressListenersRef.current.delete(onProgress);
    }
  }, [refresh]);

  const updateSort = async (target: TabName, column: string) => {
    const key = target === "library" ? "librarySort" : target === "history" ? "historySort" : "bookmarksSort";
    const current = settings[key];
    
    let nextDirection: SortConfig["direction"];
    if (current.column !== column) {
      nextDirection = "asc";
    } else if (current.direction === "asc") {
      nextDirection = "desc";
    } else if (current.direction === "desc") {
      nextDirection = "none";
    } else {
      nextDirection = "asc";
    }
    
    const nextSettings = {
      ...settings,
      [key]: { column, direction: nextDirection },
    } as ReaderSettings;
    
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    await saveSettings(nextSettings);
  };

  const readingsById = useMemo(() => new Map(readings.map((item) => [item.documentId, item])), [readings]);
  const foldersById = useMemo(() => new Map(folders.map((item) => [item.folderId, item])), [folders]);

  return (
    <AppContext.Provider value={{
      settings, setSettings,
      draftSettings, setDraftSettings,
      folders, documents, readings, bookmarks,
      readingsById, foldersById,
      activeFolderId, setActiveFolderId,
      activeDocument, setActiveDocument,
      refresh,
      rescanFolders: rescanFoldersContext,
      updateSort,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
