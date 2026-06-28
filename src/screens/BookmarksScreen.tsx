import React, { useMemo, useRef } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { BookmarkRecord, DocumentRecord } from "../types";
import { formatDate, sortIndicator } from "../lib/listFormat";

export function BookmarksScreen({ search }: { search: string }) {
  const {
    settings,
    documentsById,
    bookmarks,
    foldersById,
    openDocument,
    removeBookmark,
    updateSort,
  } = useAppContext();

  const theme = themeTokens[settings.theme];
  const ignorePressUntilRef = useRef(0);

  const bookmarkRows = useMemo(() => {
    const joined = bookmarks
      .map((bookmark) => ({ bookmark, document: documentsById.get(bookmark.documentId) }))
      .filter((row): row is { bookmark: BookmarkRecord; document: DocumentRecord } => Boolean(row.document));

    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? joined.filter((row) => row.document.title.toLowerCase().includes(keyword))
      : joined;

    const sort = settings.bookmarksSort;
    if (sort.direction === "none") return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.column === "bookTitle") return a.document.title.localeCompare(b.document.title, "ko", { numeric: true }) * dir;
      if (sort.column === "page") return (a.bookmark.page - b.bookmark.page) * dir;
      return (a.bookmark.createdAt - b.bookmark.createdAt) * dir;
    });
  }, [bookmarks, documentsById, settings.bookmarksSort, search]);

  function openBookmark(document: DocumentRecord, bookmark: BookmarkRecord) {
    if (Date.now() < ignorePressUntilRef.current) return;
    openDocument(document, { type: "bookmark", bookmarkId: bookmark.bookmarkId });
  }

  function askRemoveBookmark(bookmark: BookmarkRecord) {
    ignorePressUntilRef.current = Date.now() + 700;
    Alert.alert("책갈피 삭제", "이 책갈피를 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => void removeBookmark(bookmark.bookmarkId),
      },
    ]);
  }

  return (
    <View style={styles.content}>
      {/* Table header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable style={[styles.thCell, { flex: 2 }]} onPress={() => void updateSort("bookmarks", "folder")}>
          <Text style={[styles.thText, { color: theme.text }]}>폴더</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 4 }]} onPress={() => void updateSort("bookmarks", "bookTitle")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "bookTitle" ? theme.accentText : theme.text }]}>제목{sortIndicator(settings.bookmarksSort, "bookTitle")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 2.5 }]} onPress={() => void updateSort("bookmarks", "createdAt")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "createdAt" ? theme.accentText : theme.text, textAlign: "center" }]}>추가 일자{sortIndicator(settings.bookmarksSort, "createdAt")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 1.5 }]} onPress={() => void updateSort("bookmarks", "page")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "page" ? theme.accentText : theme.text, textAlign: "center" }]}>위치{sortIndicator(settings.bookmarksSort, "page")}</Text>
        </Pressable>
      </View>
      <FlatList
        data={bookmarkRows}
        keyExtractor={({ bookmark }) => bookmark.bookmarkId}
        ListEmptyComponent={<EmptyState title="책갈피가 없습니다." body="뷰어에서 책갈피를 추가하면 이곳에서 바로 이동할 수 있습니다." theme={theme} />}
        renderItem={({ item: { bookmark, document } }) => (
          <Pressable
            onPress={() => openBookmark(document, bookmark)}
            onLongPress={() => askRemoveBookmark(bookmark)}
            delayLongPress={500}
            style={[styles.tableRow, { borderColor: theme.border }]}
          >
            <Text numberOfLines={1} style={[styles.tdCell, { flex: 2, color: theme.secondary }]}>{foldersById.get(document.folderId)?.displayName ?? "로컬"}</Text>
            <Text numberOfLines={1} style={[styles.tdTitle, { flex: 4, color: theme.text }]}>{document.title}</Text>
            <Text style={[styles.tdCell, { flex: 2.5, textAlign: "center", color: theme.secondary }]}>{formatDate(bookmark.createdAt)}</Text>
            <Text style={[styles.tdCell, { flex: 1.5, textAlign: "center", fontWeight: "600", color: theme.accentText }]}>p.{bookmark.page}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  tableHeader: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 10 },
  thCell: { paddingHorizontal: 4, alignItems: "center" },
  thText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center" },
  tdTitle: { fontSize: 13, paddingHorizontal: 4 },
  tdCell: { fontSize: 13, paddingHorizontal: 4 },
});
