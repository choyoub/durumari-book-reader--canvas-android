import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CanvasReader } from "./src/components/CanvasReader";
import { pickDocuments } from "./src/lib/documentImport";
import { chooseSafFolder, rescanSafFolders, subscribeForegroundRescan } from "./src/lib/safImport";
import { defaultSettings, nativeFontFamily, READER_FONTS, themeTokens } from "./src/lib/settings";
import {
  clearFolders,
  initStore,
  listBookmarks,
  listDocuments,
  listFolders,
  listReadings,
  loadSettings,
  removeFolder,
  resetSettings,
  replaceFolderDocuments,
  saveReading,
  saveSettings,
  toggleBookmark,
} from "./src/lib/store";
import type {
  BookmarkRecord,
  DocumentRecord,
  FolderRecord,
  LibraryRow,
  ReaderSettings,
  ReadingRecord,
  ReadingStatus,
} from "./src/types";

type TabName = "library" | "history" | "bookmarks";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDate(value?: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function readingStatus(reading?: ReadingRecord): ReadingStatus {
  if (!reading || reading.lastPage <= 1) return "unread";
  if (reading.completed) return "completed";
  if (reading.lastPage >= reading.totalPages && reading.totalPages > 1) return "completed";
  return "reading";
}

function percent(value = 0) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function makeBookmarkId(documentId: string, page: number) {
  return `${documentId}:p${page}:${Date.now()}`;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loadingText, setLoadingText] = useState("앱 초기화 중...");
  const [viewerLoading, setViewerLoading] = useState<{ active: boolean; progress: number; message: string }>({
    active: false,
    progress: 0,
    message: "전체 페이지를 계산하는 중...",
  });
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [draftSettings, setDraftSettings] = useState<ReaderSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [tab, setTab] = useState<TabName>("library");
  const [search, setSearch] = useState("");
  const [activeDocument, setActiveDocument] = useState<DocumentRecord | null>(null);
  const [viewerPage, setViewerPage] = useState({ current: 1, total: 1 });
  const [importing, setImporting] = useState(false);
  const [bookmarkSignal, setBookmarkSignal] = useState(0);
  const [pageNavigatorOpen, setPageNavigatorOpen] = useState(false);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);
  const [pageDraft, setPageDraft] = useState("1");
  const [pageRequest, setPageRequest] = useState<{ signal: number; page: number }>({ signal: 0, page: 1 });

  const theme = themeTokens[settings.theme];

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

  const rescanFolders = useCallback(async () => {
    try {
      const currentFolders = await listFolders();
      const rescanned = await rescanSafFolders(currentFolders);
      for (const item of rescanned) {
        await replaceFolderDocuments(item.folder, item.documents);
      }
      if (rescanned.length) await refresh();
    } catch (error) {
      Alert.alert("동기화 실패", error instanceof Error ? error.message : "폴더를 다시 스캔하지 못했습니다.");
    }
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoadingText("폰트와 저장소를 준비하는 중...");
      await Promise.all([
        Font.loadAsync({
          NanumMyeongjo: require("./assets/fonts/NanumMyeongjo.ttf"),
          NanumGothic: require("./assets/fonts/NanumGothic.ttf"),
          RidiBatang: require("./assets/fonts/RidiBatang.otf"),
          MaruBuri: require("./assets/fonts/MaruBuri.ttf"),
          Pretendard: require("./assets/fonts/Pretendard.ttf"),
        }),
        initStore(),
      ]);
      const saved = await loadSettings();
      if (!mounted) return;
      setSettings(saved);
      setDraftSettings(saved);
      setLoadingText("도서 목록을 불러오는 중...");
      await refresh();
      await rescanFolders();
      if (mounted) setBooting(false);
    }
    void boot().catch((error) => {
      setBooting(false);
      Alert.alert("초기화 실패", error instanceof Error ? error.message : "앱을 초기화하지 못했습니다.");
    });
    return () => {
      mounted = false;
    };
  }, [refresh, rescanFolders]);

  useEffect(() => subscribeForegroundRescan(() => {
    void rescanFolders();
  }), [rescanFolders]);

  const readingsById = useMemo(() => new Map(readings.map((item) => [item.documentId, item])), [readings]);
  const foldersById = useMemo(() => new Map(folders.map((item) => [item.folderId, item])), [folders]);
  const rows: LibraryRow[] = useMemo(() => documents.map((document) => ({
    ...document,
    folderName: foldersById.get(document.folderId)?.displayName ?? "로컬 문서",
    reading: readingsById.get(document.documentId),
  })), [documents, foldersById, readingsById]);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (settings.hideCompleted && readingStatus(row.reading) === "completed") return false;
      if (!keyword) return true;
      return row.title.toLowerCase().includes(keyword) || row.folderName.toLowerCase().includes(keyword);
    });
    return filtered.sort((a, b) => {
      const column = settings.librarySort.column;
      const direction = settings.librarySort.direction === "asc" ? 1 : -1;
      if (column === "title") return a.title.localeCompare(b.title, "ko", { numeric: true }) * direction;
      if (column === "status") return (readingStatus(a.reading).localeCompare(readingStatus(b.reading)) * direction);
      return ((a.modifiedAt || 0) - (b.modifiedAt || 0)) * direction;
    });
  }, [rows, search, settings.hideCompleted, settings.librarySort]);

  const historyRows = useMemo(() => readings
    .map((reading) => ({ reading, document: documents.find((item) => item.documentId === reading.documentId) }))
    .filter((row): row is { reading: ReadingRecord; document: DocumentRecord } => Boolean(row.document))
    .sort((a, b) => b.reading.openedAt - a.reading.openedAt), [documents, readings]);

  const bookmarkRows = useMemo(() => bookmarks
    .map((bookmark) => ({ bookmark, document: documents.find((item) => item.documentId === bookmark.documentId) }))
    .filter((row): row is { bookmark: BookmarkRecord; document: DocumentRecord } => Boolean(row.document))
    .sort((a, b) => b.bookmark.createdAt - a.bookmark.createdAt), [bookmarks, documents]);

  async function onImport() {
    try {
      setImporting(true);
      const picked = Platform.OS === "android" ? await chooseSafFolder() : await pickDocuments();
      if (!picked || !picked.documents.length) return;
      await replaceFolderDocuments(picked.folder, picked.documents);
      await refresh();
      setTab("library");
    } catch (error) {
      Alert.alert("문서 가져오기 실패", error instanceof Error ? error.message : "문서를 가져오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }

  function openDocument(document: DocumentRecord, page?: number) {
    setViewerLoading({ active: true, progress: 0, message: "전체 페이지를 계산하는 중..." });
    setViewerPage({ current: page ?? readingsById.get(document.documentId)?.lastPage ?? 1, total: 1 });
    setActiveDocument(document);
  }

  async function onPageChanged(payload: {
    currentPage: number;
    totalPages: number;
    progress: number;
    completed?: boolean;
    preview?: string;
    boundary?: boolean;
  }) {
    if (!activeDocument || payload.boundary) {
      if (settings.pageTurnFeedback === "vibration") void Haptics.selectionAsync();
      return;
    }
    setViewerPage({ current: payload.currentPage, total: payload.totalPages });
    const prior = readingsById.get(activeDocument.documentId);
    const completed = Boolean(prior?.completed || payload.completed);
    await saveReading({
      documentId: activeDocument.documentId,
      lastPage: payload.currentPage,
      totalPages: payload.totalPages,
      progress: payload.progress,
      openedAt: Date.now(),
      completed,
      completedAt: completed ? (prior?.completedAt ?? Date.now()) : undefined,
    });
    if (settings.pageTurnFeedback === "vibration") void Haptics.selectionAsync();
    await refresh();
  }

  async function onBookmarkChanged(payload: {
    active: boolean;
    page: number;
    totalPages: number;
    progress: number;
    preview: string;
  }) {
    if (!activeDocument) return;
    await toggleBookmark({
      bookmarkId: makeBookmarkId(activeDocument.documentId, payload.page),
      documentId: activeDocument.documentId,
      page: payload.page,
      totalPages: payload.totalPages,
      progress: payload.progress,
      preview: payload.preview || activeDocument.title,
      createdAt: Date.now(),
    });
    await refresh();
  }

  async function confirmSettings() {
    await saveSettings(draftSettings);
    setSettings(draftSettings);
    setSettingsOpen(false);
  }

  function askResetSettings() {
    Alert.alert("설정 초기화", "뷰어와 목록 설정만 기본값으로 되돌릴까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "초기화",
        onPress: () => {
          void resetSettings().then((next) => {
            setDraftSettings(next);
            setSettings(next);
          });
        },
      },
    ]);
  }

  function askRemoveFolder(folderId: string) {
    Alert.alert("폴더 해제", "원본 파일은 유지하고 앱 내부의 문서/히스토리/책갈피만 삭제합니다.", [
      { text: "취소", style: "cancel" },
      { text: "해제", style: "destructive", onPress: () => void removeFolder(folderId).then(refresh) },
    ]);
  }

  function askClearFolders() {
    Alert.alert("폴더 전체 해제", "등록 폴더와 앱 내부 독서 기록을 모두 삭제합니다. 원본 파일은 삭제하지 않습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "전체 해제",
        style: "destructive",
        onPress: () => void clearFolders().then(() => {
          setActiveDocument(null);
          return refresh();
        }),
      },
    ]);
  }

  if (booting) {
    return (
      <SafeAreaView style={[styles.boot, { backgroundColor: "#0D1B2A" }]}>
        <StatusBar style="light" />
        <View style={styles.scrollMark}>
          <Text style={styles.scrollTitle}>두루마리</Text>
        </View>
        <ActivityIndicator color="#C8A870" />
        <Text style={styles.bootText}>{loadingText}</Text>
      </SafeAreaView>
    );
  }

  if (activeDocument) {
    const activeReading = readingsById.get(activeDocument.documentId);
    const initialPage = viewerPage.current || activeReading?.lastPage || 1;
    return (
      <SafeAreaView style={[styles.readerShell, { backgroundColor: theme.outer }]}>
        <StatusBar style={settings.theme === "dark" ? "light" : "dark"} />
        <View style={[styles.readerTop, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable style={styles.iconButton} onPress={() => setActiveDocument(null)}>
            <Text style={[styles.iconText, { color: theme.text }]}>‹</Text>
          </Pressable>
          <View style={styles.readerTitleWrap}>
            <Text numberOfLines={1} style={[styles.readerTitle, { color: theme.text }]}>{activeDocument.title}</Text>
            <Text style={[styles.readerMeta, { color: theme.secondary }]}>p.{viewerPage.current} / {viewerPage.total}</Text>
          </View>
          <Pressable
            style={[styles.readerAction, { borderColor: theme.border }]}
            onPress={() => setBookmarkSignal((value) => value + 1)}
          >
            <Text style={{ color: theme.accent }}>책갈피</Text>
          </Pressable>
          <Pressable
            style={[styles.readerAction, { borderColor: theme.border }]}
            onPress={() => {
              setPageDraft(String(viewerPage.current));
              setPageNavigatorOpen(true);
            }}
          >
            <Text style={{ color: theme.accent }}>이동</Text>
          </Pressable>
        </View>
        <CanvasReader
          document={activeDocument}
          settings={settings}
          initialPage={initialPage}
          bookmarks={bookmarks}
          onReady={(currentPage, totalPages) => {
            setViewerPage({ current: currentPage, total: totalPages });
            setViewerLoading({ active: false, progress: 1, message: "준비 완료" });
          }}
          onPageChanged={onPageChanged}
          onBookmarkChanged={onBookmarkChanged}
          onMenuRequested={() => setViewerMenuOpen(true)}
          onLoadingProgress={(payload) => setViewerLoading({
            active: payload.progress < 1,
            progress: payload.progress,
            message: payload.message ?? `전체 페이지를 계산하는 중... ${Math.round(payload.progress * 100)}%`,
          })}
          bookmarkSignal={bookmarkSignal}
          pageRequest={pageRequest}
        />
        {viewerLoading.active ? <ViewerLoadingOverlay theme={theme} progress={viewerLoading.progress} message={viewerLoading.message} /> : null}
        <ViewerMenuModal
          visible={viewerMenuOpen}
          title={activeDocument.title}
          current={viewerPage.current}
          total={viewerPage.total}
          theme={theme}
          onClose={() => setViewerMenuOpen(false)}
          onBookmark={() => {
            setViewerMenuOpen(false);
            setBookmarkSignal((value) => value + 1);
          }}
          onNavigate={() => {
            setViewerMenuOpen(false);
            setPageDraft(String(viewerPage.current));
            setPageNavigatorOpen(true);
          }}
          onSettings={() => {
            setViewerMenuOpen(false);
            setDraftSettings(settings);
            setSettingsOpen(true);
          }}
          onExit={() => {
            setViewerMenuOpen(false);
            setActiveDocument(null);
          }}
        />
        <PageNavigatorModal
          visible={pageNavigatorOpen}
          current={viewerPage.current}
          total={viewerPage.total}
          value={pageDraft}
          theme={theme}
          bookmarks={bookmarks.filter((item) => item.documentId === activeDocument.documentId)}
          onChange={setPageDraft}
          onClose={() => setPageNavigatorOpen(false)}
          onGo={(page) => {
            setPageNavigatorOpen(false);
            setPageRequest({ signal: Date.now(), page });
          }}
        />
        <SettingsModal
          visible={settingsOpen}
          settings={draftSettings}
          theme={themeTokens[draftSettings.theme]}
          onChange={setDraftSettings}
          onClose={() => setSettingsOpen(false)}
          onConfirm={confirmSettings}
          onReset={askResetSettings}
          onClearFolders={askClearFolders}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.app, { backgroundColor: theme.bg }]}>
      <StatusBar style={settings.theme === "dark" ? "light" : "dark"} />
      <View style={[styles.header, { borderColor: theme.border }]}>
        <Text style={[styles.brand, { color: theme.text }]}>두루마리</Text>
        <Pressable style={[styles.smallButton, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => {
          setDraftSettings(settings);
          setSettingsOpen(true);
        }}>
          <Text style={{ color: theme.text }}>설정</Text>
        </Pressable>
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="제목 또는 폴더 검색"
          placeholderTextColor={theme.secondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={[styles.tabs, { borderColor: theme.border }]}>
        {(["library", "history", "bookmarks"] as const).map((name) => (
          <Pressable key={name} style={[styles.tab, tab === name && { borderBottomColor: theme.accent }]} onPress={() => setTab(name)}>
            <Text style={[styles.tabText, { color: tab === name ? theme.accent : theme.secondary }]}>
              {name === "library" ? "목록" : name === "history" ? "히스토리" : "책갈피"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "library" && (
        <View style={styles.content}>
          <View style={styles.folderBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
              {folders.map((folder) => (
                <Pressable key={folder.folderId} onLongPress={() => askRemoveFolder(folder.folderId)} style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text numberOfLines={1} style={{ color: theme.text }}>{folder.displayName}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.chip, { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={onImport} disabled={importing}>
                <Text style={styles.accentButtonText}>{importing ? "동기화 중" : "+ 폴더"}</Text>
              </Pressable>
              <Pressable style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={rescanFolders} disabled={importing}>
                <Text style={{ color: theme.text }}>재동기화</Text>
              </Pressable>
            </ScrollView>
          </View>
          {visibleRows.length === 0 ? (
            <EmptyState
              title={documents.length ? "검색 결과가 없습니다." : "아직 등록된 문서가 없습니다."}
              body={documents.length ? "검색어를 지우거나 다른 제목을 찾아보세요." : "로컬 문서를 가져와 두루마리 서재를 시작하세요."}
              action="문서 가져오기"
              onAction={onImport}
              theme={theme}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {visibleRows.map((row) => {
                const status = readingStatus(row.reading);
                return (
                  <Pressable key={row.documentId} onPress={() => openDocument(row)} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.rowMain}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>{row.title}</Text>
                      <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.secondary }]}>{row.folderName} · {formatDate(row.modifiedAt)}</Text>
                    </View>
                    <Text style={[styles.status, { color: theme[status] }]}>
                      {status === "unread" ? "미독" : status === "reading" ? "읽는 중" : "완독"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {tab === "history" && (
        <ScrollView contentContainerStyle={styles.list}>
          {historyRows.length === 0 ? <EmptyState title="최근 읽은 문서가 없습니다." body="문서를 열고 페이지를 넘기면 여기에 기록됩니다." theme={theme} /> : historyRows.map(({ reading, document }) => (
            <Pressable key={reading.documentId} onPress={() => openDocument(document, reading.lastPage)} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowMain}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>{document.title}</Text>
                <Text style={[styles.rowMeta, { color: theme.secondary }]}>{formatDate(reading.openedAt)}</Text>
              </View>
              <Text style={[styles.status, { color: theme[readingStatus(reading)] }]}>{percent(reading.progress)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {tab === "bookmarks" && (
        <ScrollView contentContainerStyle={styles.list}>
          {bookmarkRows.length === 0 ? <EmptyState title="책갈피가 없습니다." body="뷰어에서 책갈피를 추가하면 이곳에서 바로 이동할 수 있습니다." theme={theme} /> : bookmarkRows.map(({ bookmark, document }) => (
            <Pressable key={bookmark.bookmarkId} onPress={() => openDocument(document, bookmark.page)} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowMain}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>{document.title}</Text>
                <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.secondary }]}>{bookmark.preview || formatDate(bookmark.createdAt)}</Text>
              </View>
              <Text style={[styles.status, { color: theme.accent }]}>p.{bookmark.page}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SettingsModal
        visible={settingsOpen}
        settings={draftSettings}
        theme={themeTokens[draftSettings.theme]}
        onChange={setDraftSettings}
        onClose={() => setSettingsOpen(false)}
        onConfirm={confirmSettings}
        onReset={askResetSettings}
        onClearFolders={askClearFolders}
      />
    </SafeAreaView>
  );
}

function EmptyState({
  title,
  body,
  action,
  onAction,
  theme,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  theme: typeof themeTokens.paper;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.secondary }]}>{body}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.accentButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ViewerMenuModal({
  visible,
  title,
  current,
  total,
  theme,
  onClose,
  onBookmark,
  onNavigate,
  onSettings,
  onExit,
}: {
  visible: boolean;
  title: string;
  current: number;
  total: number;
  theme: typeof themeTokens.paper;
  onClose: () => void;
  onBookmark: () => void;
  onNavigate: () => void;
  onSettings: () => void;
  onExit: () => void;
}) {
  const ratio = total <= 1 ? 0 : (current - 1) / Math.max(1, total - 1);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <View style={[styles.viewerMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.modalTitle}>
            <View style={styles.readerTitleWrap}>
              <Text numberOfLines={1} style={[styles.modalHeading, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.readerMeta, { color: theme.secondary }]}>p.{current} / {total}</Text>
            </View>
            <Pressable onPress={onClose}><Text style={{ color: theme.secondary, fontSize: 20 }}>×</Text></Pressable>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.round(ratio * 100)}%` }]} />
          </View>
          <View style={styles.viewerActions}>
            <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onBookmark}>
              <Text style={[styles.viewerActionIcon, { color: theme.accent }]}>⌑</Text>
              <Text style={{ color: theme.text }}>책갈피</Text>
            </Pressable>
            <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onNavigate}>
              <Text style={[styles.viewerActionIcon, { color: theme.accent }]}>↗</Text>
              <Text style={{ color: theme.text }}>페이지 이동</Text>
            </Pressable>
            <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onSettings}>
              <Text style={[styles.viewerActionIcon, { color: theme.accent }]}>⚙</Text>
              <Text style={{ color: theme.text }}>설정</Text>
            </Pressable>
            <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onExit}>
              <Text style={[styles.viewerActionIcon, { color: theme.accent }]}>☰</Text>
              <Text style={{ color: theme.text }}>목록</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ViewerLoadingOverlay({
  theme,
  progress,
  message,
}: {
  theme: typeof themeTokens.paper;
  progress: number;
  message: string;
}) {
  const safeProgress = clamp(progress, 0, 1);
  return (
    <View style={[styles.viewerLoading, { backgroundColor: theme.outer }]}>
      <View style={[styles.viewerLoadingScroll, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <Text style={[styles.viewerLoadingTitle, { color: theme.text }]}>두루마리</Text>
        <Text style={[styles.viewerLoadingSubtitle, { color: theme.secondary }]}>문서를 펼치는 중</Text>
      </View>
      <View style={[styles.viewerLoadingTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.viewerLoadingFill, { backgroundColor: theme.accent, width: `${Math.round(safeProgress * 100)}%` }]} />
      </View>
      <Text style={[styles.viewerLoadingText, { color: theme.text }]}>
        {message.includes("%") ? message : `${message} ${Math.round(safeProgress * 100)}%`}
      </Text>
    </View>
  );
}

function SettingsModal({
  visible,
  settings,
  theme,
  onChange,
  onClose,
  onConfirm,
  onReset,
  onClearFolders,
}: {
  visible: boolean;
  settings: ReaderSettings;
  theme: typeof themeTokens.paper;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onClearFolders: () => void;
}) {
  const patch = (next: Partial<ReaderSettings>) => onChange({ ...settings, ...next });
  const previewFont = nativeFontFamily(settings.fontFamily);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.settingsSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.modalTitle}>
            <Text style={[styles.modalHeading, { color: theme.text }]}>설정</Text>
            <Pressable onPress={onClose}><Text style={{ color: theme.secondary, fontSize: 20 }}>×</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.preview, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={{
                color: theme.text,
                fontFamily: previewFont,
                fontSize: settings.fontSize,
                fontWeight: settings.isBold ? "700" : "400",
                lineHeight: settings.fontSize * settings.lineHeight,
                letterSpacing: settings.letterSpacing,
              }}>
                소년은 개울가에서 소녀를 보자 곧 윤 초시네 증손녀딸이라는 걸 알 수 있었다.
              </Text>
            </View>

            <SettingTitle text="읽기 설정" theme={theme} />
            <Text style={[styles.label, { color: theme.secondary }]}>서체</Text>
            <View style={styles.fontGrid}>
              {READER_FONTS.map((font) => (
                <Pressable
                  key={font.value}
                  onPress={() => patch({ fontFamily: font.value })}
                  style={[styles.choice, { borderColor: settings.fontFamily === font.value ? theme.accent : theme.border }]}
                >
                  <Text style={{ color: settings.fontFamily === font.value ? theme.accent : theme.text, fontFamily: font.native }}>{font.label}</Text>
                </Pressable>
              ))}
            </View>
            <Stepper label="글자 크기" value={settings.fontSize} min={10} max={36} unit="pt" theme={theme} onChange={(fontSize) => patch({ fontSize })} />
            <Stepper label="줄 간격" value={settings.lineHeight} min={1} max={2.5} step={0.1} theme={theme} onChange={(lineHeight) => patch({ lineHeight })} />
            <Stepper label="자간" value={settings.letterSpacing} min={-2} max={5} unit="px" theme={theme} onChange={(letterSpacing) => patch({ letterSpacing })} />
            <Pressable onPress={() => patch({ isBold: !settings.isBold })} style={[styles.checkRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text }}>굵게</Text>
              <Text style={{ color: theme.accent }}>{settings.isBold ? "켬" : "끔"}</Text>
            </Pressable>

            <SettingTitle text="여백 설정" theme={theme} />
            <Pressable onPress={() => patch({ paddingLinked: !settings.paddingLinked })} style={[styles.checkRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text }}>좌우 여백 동일하게 조절</Text>
              <Text style={{ color: theme.accent }}>{settings.paddingLinked ? "켬" : "끔"}</Text>
            </Pressable>
            <Stepper label="위" value={settings.paddingTop} min={0} max={120} step={5} unit="px" theme={theme} onChange={(paddingTop) => patch({ paddingTop })} />
            <Stepper label="아래" value={settings.paddingBottom} min={0} max={120} step={5} unit="px" theme={theme} onChange={(paddingBottom) => patch({ paddingBottom })} />
            <Stepper label="좌우" value={settings.paddingLeft} min={0} max={150} step={5} unit="px" theme={theme} onChange={(value) => patch({ paddingLeft: value, paddingRight: settings.paddingLinked ? value : settings.paddingRight })} />

            <SettingTitle text="페이지 이동 및 피드백" theme={theme} />
            <Segment
              values={[["none", "없음"], ["vibration", "진동"], ["sound", "소리"]]}
              current={settings.pageTurnFeedback}
              theme={theme}
              onChange={(pageTurnFeedback) => patch({ pageTurnFeedback: pageTurnFeedback as ReaderSettings["pageTurnFeedback"] })}
            />
            <Segment
              values={[["none", "없음"], ["curl", "책장 넘김"], ["slide", "슬라이드"]]}
              current={settings.pageTurnStyle}
              theme={theme}
              onChange={(pageTurnStyle) => patch({ pageTurnStyle: pageTurnStyle as ReaderSettings["pageTurnStyle"] })}
            />

            <SettingTitle text="테마 및 데이터" theme={theme} />
            <Segment
              values={[["paper", "한지"], ["light", "화이트"], ["dark", "다크"]]}
              current={settings.theme}
              theme={theme}
              onChange={(value) => patch({ theme: value as ReaderSettings["theme"] })}
            />
            <Pressable onPress={() => patch({ hideCompleted: !settings.hideCompleted })} style={[styles.checkRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text }}>완독한 책 목록에서 숨김</Text>
              <Text style={{ color: theme.accent }}>{settings.hideCompleted ? "켬" : "끔"}</Text>
            </Pressable>
            <View style={styles.dangerRow}>
              <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={onReset}>
                <Text style={{ color: theme.text }}>설정 초기화</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, { borderColor: theme.danger }]} onPress={onClearFolders}>
                <Text style={{ color: theme.danger }}>폴더 전체 해제</Text>
              </Pressable>
            </View>
          </ScrollView>
          <Pressable onPress={onConfirm} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.accentButtonText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PageNavigatorModal({
  visible,
  current,
  total,
  value,
  bookmarks,
  theme,
  onChange,
  onClose,
  onGo,
}: {
  visible: boolean;
  current: number;
  total: number;
  value: string;
  bookmarks: BookmarkRecord[];
  theme: typeof themeTokens.paper;
  onChange: (value: string) => void;
  onClose: () => void;
  onGo: (page: number) => void;
}) {
  const numeric = clamp(Number(value) || current, 1, Math.max(1, total));
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);
  const previous = [...sorted].reverse().find((item) => item.page < current);
  const next = sorted.find((item) => item.page > current);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <View style={[styles.pageDialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.modalTitle}>
            <Text style={[styles.modalHeading, { color: theme.text }]}>페이지 이동</Text>
            <Pressable onPress={onClose}><Text style={{ color: theme.secondary, fontSize: 20 }}>×</Text></Pressable>
          </View>
          <View style={styles.pageInputRow}>
            <TextInput
              value={value}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              style={[styles.pageInput, { color: theme.text, borderColor: theme.border }]}
            />
            <Text style={{ color: theme.secondary }}>/ {total}</Text>
          </View>
          <View style={styles.quickGrid}>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={() => onGo(1)}>
              <Text style={{ color: theme.text }}>처음</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border, opacity: previous ? 1 : .45 }]} disabled={!previous} onPress={() => previous && onGo(previous.page)}>
              <Text style={{ color: theme.text }}>이전 책갈피</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border, opacity: next ? 1 : .45 }]} disabled={!next} onPress={() => next && onGo(next.page)}>
              <Text style={{ color: theme.text }}>다음 책갈피</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onGo(numeric)} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.accentButtonText}>이동하기</Text>
          </Pressable>
          <Text style={[styles.pageHint, { color: theme.secondary }]}>현재 p.{current}</Text>
        </View>
      </View>
    </Modal>
  );
}

function SettingTitle({ text, theme }: { text: string; theme: typeof themeTokens.paper }) {
  return <Text style={[styles.settingTitle, { color: theme.accent }]}>{text}</Text>;
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  theme,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  theme: typeof themeTokens.paper;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={[styles.label, { color: theme.secondary }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={[styles.stepButton, { borderColor: theme.border }]} onPress={() => onChange(clamp(Number((value - step).toFixed(2)), min, max))}>
          <Text style={{ color: theme.text }}>−</Text>
        </Pressable>
        <Text style={[styles.stepValue, { color: theme.text }]}>{value}{unit}</Text>
        <Pressable style={[styles.stepButton, { borderColor: theme.border }]} onPress={() => onChange(clamp(Number((value + step).toFixed(2)), min, max))}>
          <Text style={{ color: theme.text }}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Segment({
  values,
  current,
  theme,
  onChange,
}: {
  values: [string, string][];
  current: string;
  theme: typeof themeTokens.paper;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {values.map(([value, label]) => (
        <Pressable key={value} onPress={() => onChange(value)} style={[styles.segmentItem, { borderColor: current === value ? theme.accent : theme.border, backgroundColor: current === value ? theme.bg : "transparent" }]}>
          <Text style={{ color: current === value ? theme.accent : theme.text }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  bootText: { color: "rgba(255,255,255,.72)", fontSize: 13 },
  scrollMark: { width: 142, height: 188, borderWidth: 1, borderColor: "#6F4F2A", backgroundColor: "#EAD9AF", alignItems: "center", justifyContent: "center" },
  scrollTitle: { fontFamily: "NanumMyeongjo", fontSize: 26, letterSpacing: 4, color: "#21170F" },
  header: { height: 58, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: "NanumMyeongjo", fontSize: 24, fontWeight: "700" },
  smallButton: { minHeight: 34, paddingHorizontal: 14, borderWidth: 1, justifyContent: "center" },
  searchBox: { margin: 14, height: 42, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center" },
  searchInput: { fontSize: 15 },
  tabs: { height: 46, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontWeight: "700" },
  content: { flex: 1 },
  folderBar: { minHeight: 48 },
  folderChips: { paddingHorizontal: 14, gap: 8, alignItems: "center" },
  chip: { minHeight: 32, maxWidth: 180, paddingHorizontal: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 14, gap: 10, flexGrow: 1 },
  row: { minHeight: 72, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  rowMain: { flex: 1, minWidth: 0, gap: 5 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowMeta: { fontSize: 12 },
  status: { fontWeight: "800", minWidth: 62, textAlign: "right" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  primaryButton: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 10 },
  secondaryButton: { minHeight: 40, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, flex: 1 },
  accentButtonText: { color: "#fff", fontWeight: "800" },
  readerShell: { flex: 1 },
  readerTop: { height: 56, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 34, lineHeight: 36 },
  readerTitleWrap: { flex: 1, minWidth: 0 },
  readerTitle: { fontWeight: "800", fontSize: 15 },
  readerMeta: { fontSize: 12, marginTop: 2 },
  readerAction: { borderWidth: 1, minHeight: 34, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  viewerLoading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, alignItems: "center", justifyContent: "center", gap: 16, padding: 28 },
  viewerLoadingScroll: { width: 150, height: 190, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: .2, shadowRadius: 18, elevation: 4 },
  viewerLoadingTitle: { fontFamily: "NanumMyeongjo", fontSize: 24, fontWeight: "800", letterSpacing: 3 },
  viewerLoadingSubtitle: { marginTop: 8, fontSize: 12 },
  viewerLoadingTrack: { width: "78%", maxWidth: 360, height: 6, overflow: "hidden" },
  viewerLoadingFill: { height: "100%" },
  viewerLoadingText: { fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "flex-end" },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center", padding: 18 },
  viewerMenu: { width: "100%", maxWidth: 420, borderWidth: 1, padding: 18, gap: 16 },
  progressTrack: { height: 8, overflow: "hidden" },
  progressFill: { height: "100%" },
  viewerActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  viewerAction: { width: "48%", minHeight: 76, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  viewerActionIcon: { fontSize: 22, fontWeight: "800" },
  settingsSheet: { maxHeight: "92%", borderTopWidth: 1, padding: 18, gap: 12 },
  modalTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalHeading: { fontSize: 20, fontWeight: "800" },
  preview: { minHeight: 150, borderWidth: 1, padding: 18, justifyContent: "center" },
  settingTitle: { marginTop: 18, marginBottom: 10, fontSize: 15, fontWeight: "800" },
  label: { fontSize: 12, marginBottom: 6 },
  fontGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 38, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  stepper: { marginBottom: 12 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepButton: { width: 40, height: 36, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 68, textAlign: "center", fontWeight: "700" },
  checkRow: { minHeight: 42, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  segment: { flexDirection: "row", gap: 8, marginBottom: 10 },
  segmentItem: { flex: 1, minHeight: 38, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dangerRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  pageDialog: { width: "100%", maxWidth: 420, borderWidth: 1, padding: 18, gap: 14 },
  pageInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  pageInput: { width: 96, height: 42, borderWidth: 1, textAlign: "center", fontSize: 18, fontWeight: "800" },
  quickGrid: { flexDirection: "row", gap: 8 },
  pageHint: { textAlign: "right", fontSize: 12 },
});
