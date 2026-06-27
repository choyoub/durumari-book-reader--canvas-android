import React, { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { DocumentRecord, FolderRecord, LibraryRow, readingStatus } from "../types";
import { chooseSafFolder } from "../lib/safImport";
import { pickDocuments } from "../lib/documentImport";
import { replaceFolderDocuments, removeFolder } from "../lib/store";
import { formatDate, sortIndicator } from "../lib/listFormat";

export function LibraryScreen({ search }: { search: string }) {
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

  const rows: LibraryRow[] = useMemo(() => documents.map((document) => ({
    ...document,
    folderName: foldersById.get(document.folderId)?.displayName ?? "로컬 문서",
    reading: readingsById.get(document.documentId),
  })), [documents, foldersById, readingsById]);

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

  return (
    <View style={styles.content}>
      {/* Folder Tabs */}
      <View style={styles.folderBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
          {folders.map((folder) => {
            const isActive = activeFolderId === folder.folderId;
            const isError = folder.permissionStatus === "required";
            return (
              <View key={folder.folderId} style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  onPress={() => setActiveFolderId(folder.folderId)}
                  style={[styles.chip, {
                    backgroundColor: isActive ? theme.accent : theme.card,
                    borderColor: isError ? "#E53935" : isActive ? theme.accent : theme.border,
                    paddingRight: 6,
                  }]}
                >
                  <Text numberOfLines={1} style={{ color: isError ? "#E53935" : isActive ? theme.accentForeground : theme.text, fontWeight: isActive ? "800" : "400", maxWidth: 120 }}>
                    {isError ? "⚠️ " : ""}{folder.displayName}
                  </Text>
                  <Pressable
                    onPress={() => askRemoveFolder(folder.folderId)}
                    hitSlop={6}
                    style={{ marginLeft: 6, width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)" }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: isActive ? theme.accentForeground : theme.secondary }}>✕</Text>
                  </Pressable>
                </Pressable>
              </View>
            );
          })}
          <Pressable style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onImport} disabled={importing}>
            <Text style={{ color: theme.accentText, fontWeight: "800" }}>{importing ? "🔄 동기화 중" : "📁 + 폴더"}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Table header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable style={[styles.thCell, { flex: 5 }]} onPress={() => void updateSort("library", "title")}>
          <Text style={[styles.thText, { color: settings.librarySort.column === "title" ? theme.accentText : theme.text }]}>제목{sortIndicator(settings.librarySort, "title")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 3 }]} onPress={() => void updateSort("library", "modifiedAt")}>
          <Text style={[styles.thText, { color: settings.librarySort.column === "modifiedAt" ? theme.accentText : theme.text, textAlign: "center" }]}>파일 일자{sortIndicator(settings.librarySort, "modifiedAt")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 1.5 }]} onPress={() => void updateSort("library", "status")}>
          <Text style={[styles.thText, { color: settings.librarySort.column === "status" ? theme.accentText : theme.text, textAlign: "center" }]}>상태{sortIndicator(settings.librarySort, "status")}</Text>
        </Pressable>
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
        <ScrollView>
          {visibleRows.map((row) => {
            const status = readingStatus(row.reading);
            const statusColor = theme[status];
            return (
              <Pressable key={row.documentId} onPress={() => setActiveDocument(row)} style={[styles.tableRow, { borderColor: theme.border }]}>
                <Text numberOfLines={1} style={[styles.tdTitle, { flex: 5, color: statusColor, fontWeight: "600" }]}>{row.title}</Text>
                <Text style={[styles.tdCell, { flex: 3, textAlign: "center", color: theme.secondary }]}>{formatDate(row.modifiedAt)}</Text>
                <Text style={[styles.tdCell, { flex: 1.5, textAlign: "center", fontWeight: "600", color: statusColor }]}>
                  {status === "unread" ? "미독" : status === "reading" ? "읽는 중" : "완독"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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
          <View style={[styles.pageDialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  folderBar: { minHeight: 48 },
  folderChips: { paddingHorizontal: 14, gap: 8, alignItems: "center" },
  chip: { minHeight: 32, maxWidth: 180, paddingHorizontal: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  tableHeader: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 10 },
  thCell: { paddingHorizontal: 4, alignItems: "center" },
  thText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center" },
  tdTitle: { fontSize: 13, paddingHorizontal: 4 },
  tdCell: { fontSize: 13, paddingHorizontal: 4 },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  pageDialog: { width: 300, borderWidth: 1, borderRadius: 8, padding: 18, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalHeading: { fontSize: 18, fontWeight: "700" },
  pageInput: { height: 42, borderWidth: 1, paddingHorizontal: 12, borderRadius: 4, fontSize: 16, textAlign: "center" },
  primaryButton: { height: 46, alignItems: "center", justifyContent: "center", borderRadius: 4 },
  accentButtonText: { fontWeight: "700", fontSize: 16 },
});
