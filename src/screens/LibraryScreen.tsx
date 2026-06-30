import React, { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { ResponsiveDialogSurface } from "../components/ResponsiveFrame";
import { themeTokens } from "../lib/settings";
import { DocumentRecord, FolderRecord, LibraryRow, readingStatus } from "../types";
import { chooseSafFolder } from "../lib/safImport";
import { pickDocuments } from "../lib/documentImport";
import { replaceFolderDocuments, removeFolder } from "../lib/store";
import { formatDate, sortIndicator } from "../lib/listFormat";

export function LibraryScreen({ search, onSearchChange }: { search: string; onSearchChange: (search: string) => void }) {
  const {
    settings,
    folders,
    documents,
    readingsById,
    foldersById,
    activeFolderId,
    setActiveFolderId,
    setActiveDocument,
    refresh,
    updateSort,
  } = useAppContext();

  const [importing, setImporting] = useState(false);
  const [folderNameModalVisible, setFolderNameModalVisible] = useState(false);
  const [pendingFolder, setPendingFolder] = useState<{ folder: FolderRecord; documents: DocumentRecord[] } | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");

  const theme = themeTokens[settings.theme];

  const rows: LibraryRow[] = useMemo(() => {
    return documents.map((document) => ({
      ...document,
      folderName: foldersById.get(document.folderId)?.displayName ?? "로컬 문서",
      reading: readingsById.get(document.documentId),
    }));
  }, [documents, foldersById, readingsById]);

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let filtered = rows.filter((row) => {
      if (activeFolderId && row.folderId !== activeFolderId) return false;
      if (settings.hideCompleted && readingStatus(row.reading) === "completed") return false;
      if (!keyword) return true;
      return row.title.toLowerCase().includes(keyword);
    });
    const sort = settings.librarySort;
    if (sort.direction !== "none") {
      const dir = sort.direction === "asc" ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        if (sort.column === "title") return a.title.localeCompare(b.title, "ko", { numeric: true }) * dir;
        if (sort.column === "status") return readingStatus(a.reading).localeCompare(readingStatus(b.reading)) * dir;
        return ((a.modifiedAt || 0) - (b.modifiedAt || 0)) * dir;
      });
    }
    return filtered;
  }, [rows, search, settings.hideCompleted, settings.librarySort, activeFolderId]);

  async function onImport() {
    try {
      setImporting(true);
      const picked = Platform.OS === "android" ? await chooseSafFolder() : await pickDocuments();
      if (!picked) return;
      setPendingFolder(picked);
      setFolderNameDraft(picked.folder.displayName);
      setFolderNameModalVisible(true);
    } catch (error) {
      Alert.alert("문서 가져오기 실패", error instanceof Error ? error.message : "문서를 가져오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }

  async function confirmFolderName() {
    if (!pendingFolder) return;
    const name = folderNameDraft.trim() || pendingFolder.folder.displayName;
    const folder = { ...pendingFolder.folder, displayName: name };
    await replaceFolderDocuments(folder, pendingFolder.documents);
    await refresh();
    setActiveFolderId(folder.folderId);
    setFolderNameModalVisible(false);
    setPendingFolder(null);
    setFolderNameDraft("");
  }

  function askRemoveFolder(folderId: string) {
    Alert.alert("폴더 해제", "이 기기에서 폴더 연결을 해제하시겠습니까? 실제 파일은 삭제되지 않습니다.", [
      { text: "취소", style: "cancel" },
      { text: "해제", style: "destructive", onPress: async () => {
        await removeFolder(folderId);
        await refresh();
      }}
    ]);
  }

  function statusLabel(status: ReturnType<typeof readingStatus>) {
    return status === "unread" ? "미독" : status === "reading" ? "읽는 중" : "완독";
  }

  return (
    <View style={styles.content}>
      <View style={[styles.folderBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
          {folders.map((folder) => {
            const isActive = activeFolderId === folder.folderId;
            const isError = folder.permissionStatus === "required";
            return (
              <View key={folder.folderId} style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  onPress={() => setActiveFolderId(folder.folderId)}
                  style={[styles.chip, {
                    backgroundColor: theme.card,
                    borderColor: isError ? "#E53935" : theme.border,
                  }]}
                >
                  <View style={[styles.chipLabel, isActive && { backgroundColor: theme.accent }]}>
                    <Text numberOfLines={1} style={[styles.chipText, { color: isError ? "#E53935" : isActive ? theme.accentForeground : theme.secondary }]}>
                      {isError ? "⚠️ " : ""}{folder.displayName}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => askRemoveFolder(folder.folderId)}
                    hitSlop={6}
                    style={[styles.chipRemove, { backgroundColor: isActive ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.06)" }]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: isActive ? theme.accentForeground : theme.secondary }}>✕</Text>
                  </Pressable>
                </Pressable>
              </View>
            );
          })}
          <Pressable style={[styles.addChip, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onImport} disabled={importing}>
            <Text style={[styles.addChipText, { color: theme.accentText }]}>{importing ? "동기화 중" : "+ 폴더"}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={[styles.sortBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="현재 폴더 제목 검색"
            placeholderTextColor={theme.secondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroller} contentContainerStyle={styles.sortControls}>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.librarySort.column === "title" ? theme.card : "transparent" }]} onPress={() => void updateSort("library", "title")}>
            <Text style={[styles.sortPillText, { color: settings.librarySort.column === "title" ? theme.accentText : theme.secondary }]}>제목{sortIndicator(settings.librarySort, "title")}</Text>
          </Pressable>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.librarySort.column === "modifiedAt" ? theme.card : "transparent" }]} onPress={() => void updateSort("library", "modifiedAt")}>
            <Text style={[styles.sortPillText, { color: settings.librarySort.column === "modifiedAt" ? theme.accentText : theme.secondary }]}>파일 일자{sortIndicator(settings.librarySort, "modifiedAt")}</Text>
          </Pressable>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.librarySort.column === "status" ? theme.card : "transparent" }]} onPress={() => void updateSort("library", "status")}>
            <Text style={[styles.sortPillText, { color: settings.librarySort.column === "status" ? theme.accentText : theme.secondary }]}>상태{sortIndicator(settings.librarySort, "status")}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <FlatList
        data={visibleRows}
        keyExtractor={(row) => row.documentId}
        contentContainerStyle={visibleRows.length ? styles.listContent : styles.emptyListContent}
        ListEmptyComponent={(
          <EmptyState
            title={documents.length ? "검색 결과가 없습니다." : "아직 등록된 문서가 없습니다."}
            body={documents.length ? "검색어를 지우거나 다른 제목을 찾아보세요." : "로컬 문서를 가져와 두루마리 서재를 시작하세요."}
            action="문서 가져오기"
            onAction={onImport}
            theme={theme}
          />
        )}
        renderItem={({ item: row }) => {
            const status = readingStatus(row.reading);
            const statusColor = theme[status];
            const progress = row.reading ? Math.round(row.reading.progress * 100) : 0;
            return (
              <Pressable onPress={() => setActiveDocument(row)} style={[styles.bookCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <View style={styles.bookCardHeader}>
                  <Text numberOfLines={2} style={[styles.bookTitle, { color: theme.text }]}>{row.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A`, borderColor: statusColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel(status)}</Text>
                  </View>
                </View>
                <View style={styles.bookMetaRow}>
                  <Text numberOfLines={1} style={[styles.bookMeta, { color: theme.secondary }]}>{row.folderName}</Text>
                  <Text style={[styles.bookMeta, { color: theme.secondary }]}>{formatDate(row.modifiedAt)}</Text>
                </View>
                {status !== "unread" ? (
                  <View style={styles.progressRow}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                      <View style={[styles.progressFill, { backgroundColor: statusColor, width: `${Math.max(4, progress)}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: statusColor }]}>{progress}%</Text>
                  </View>
                ) : null}
              </Pressable>
            );
        }}
      />

      {/* Folder Name Input Modal */}
      <Modal
        visible={folderNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderNameModalVisible(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.centerBackdrop}>
          <ResponsiveDialogSurface theme={theme} maxWidth={420}>
            <View style={styles.modalTitle}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>폴더 이름 지정</Text>
              <Pressable onPress={() => { setFolderNameModalVisible(false); setPendingFolder(null); }}>
                <Text style={{ color: theme.secondary, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
            <Text style={{ color: theme.secondary, fontSize: 13, marginBottom: 12 }}>탭에 표시될 이름을 입력하세요</Text>
            <TextInput
              value={folderNameDraft}
              onChangeText={setFolderNameDraft}
              placeholder="폴더 이름"
              placeholderTextColor={theme.secondary}
              style={[styles.pageInput, { color: theme.text, borderColor: theme.border, width: "100%", marginBottom: 16 }]}
              autoFocus
            />
            <Pressable onPress={() => void confirmFolderName()} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <Text style={[styles.accentButtonText, { color: theme.accentForeground }]}>등록하기</Text>
            </Pressable>
          </ResponsiveDialogSurface>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  folderBar: { minHeight: 52 },
  folderChips: { paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: "center" },
  chip: { minHeight: 36, maxWidth: 230, padding: 3, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", borderRadius: 14 },
  chipLabel: { minHeight: 28, maxWidth: 154, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  chipText: { fontSize: 13, fontWeight: "800", maxWidth: 136 },
  chipRemove: { marginLeft: 4, marginRight: 1, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  addChip: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", borderRadius: 14 },
  addChipText: { fontSize: 13, fontWeight: "800" },
  sortBar: { minHeight: 52, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  searchBox: { width: "42%", minWidth: 120, maxWidth: 260, height: 36, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", flexDirection: "row", borderRadius: 18 },
  searchIcon: { width: 22, fontSize: 16, lineHeight: 20, marginRight: 6, textAlign: "center" },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  sortScroller: { flex: 1 },
  sortControls: { flexGrow: 1, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  sortPill: { minHeight: 32, paddingHorizontal: 12, borderWidth: 1, borderRadius: 16, justifyContent: "center" },
  sortPillText: { fontSize: 12, fontWeight: "800" },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, gap: 10 },
  emptyListContent: { flexGrow: 1 },
  bookCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  bookCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bookTitle: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  statusBadge: { minHeight: 28, paddingHorizontal: 10, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statusBadgeText: { fontSize: 12, fontWeight: "900" },
  bookMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  bookMeta: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { width: 38, textAlign: "right", fontSize: 12, fontWeight: "900" },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  modalTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalHeading: { fontSize: 18, fontWeight: "700" },
  pageInput: { height: 44, borderWidth: 1, paddingHorizontal: 12, borderRadius: 12, fontSize: 16, textAlign: "center" },
  primaryButton: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  accentButtonText: { fontWeight: "700", fontSize: 16 },
});
