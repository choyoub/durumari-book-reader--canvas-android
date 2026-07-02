import React, { useMemo, useRef } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { BookmarkRecord, DocumentRecord } from "../types";
import { formatDate, sortIndicator } from "../lib/listFormat";

export function BookmarksScreen({ search, onSearchChange }: { search: string; onSearchChange: (search: string) => void }) {
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
      <View style={[styles.sortBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="책갈피 제목 검색"
            placeholderTextColor={theme.secondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <View style={[styles.sortGroup, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Pressable style={[styles.sortSegment, styles.sortSegmentFirst, settings.bookmarksSort.column === "bookTitle" && { backgroundColor: theme.accent }]} onPress={() => void updateSort("bookmarks", "bookTitle")}>
            <Text numberOfLines={1} style={[styles.sortSegmentText, { color: settings.bookmarksSort.column === "bookTitle" ? theme.accentForeground : theme.secondary }]}>제목{sortIndicator(settings.bookmarksSort, "bookTitle")}</Text>
          </Pressable>
          <Pressable style={[styles.sortSegment, styles.sortSegmentMiddle, { borderLeftColor: theme.border }, settings.bookmarksSort.column === "createdAt" && { backgroundColor: theme.accent }]} onPress={() => void updateSort("bookmarks", "createdAt")}>
            <Text numberOfLines={1} style={[styles.sortSegmentText, { color: settings.bookmarksSort.column === "createdAt" ? theme.accentForeground : theme.secondary }]}>일자{sortIndicator(settings.bookmarksSort, "createdAt")}</Text>
          </Pressable>
          <Pressable style={[styles.sortSegment, styles.sortSegmentLast, { borderLeftColor: theme.border }, settings.bookmarksSort.column === "page" && { backgroundColor: theme.accent }]} onPress={() => void updateSort("bookmarks", "page")}>
            <Text numberOfLines={1} style={[styles.sortSegmentText, { color: settings.bookmarksSort.column === "page" ? theme.accentForeground : theme.secondary }]}>위치{sortIndicator(settings.bookmarksSort, "page")}</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={bookmarkRows}
        keyExtractor={({ bookmark }) => bookmark.bookmarkId}
        contentContainerStyle={bookmarkRows.length ? styles.listContent : styles.emptyListContent}
        ListEmptyComponent={<EmptyState title="책갈피가 없습니다." body="뷰어에서 책갈피를 추가하면 이곳에서 바로 이동할 수 있습니다." theme={theme} />}
        renderItem={({ item: { bookmark, document } }) => (
          <Pressable
            onPress={() => openBookmark(document, bookmark)}
            onLongPress={() => askRemoveBookmark(bookmark)}
            delayLongPress={500}
            style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <View style={styles.cardHeader}>
              <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{document.title}</Text>
              <View style={[styles.pageBadge, { borderColor: theme.accent, backgroundColor: `${theme.accent}1A` }]}>
                <Text style={[styles.pageBadgeText, { color: theme.accentText }]}>p.{bookmark.page}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={[styles.preview, { color: theme.secondary }]}>{bookmark.preview || document.title}</Text>
            <View style={styles.metaRow}>
              <Text numberOfLines={1} style={[styles.meta, { color: theme.secondary }]}>{foldersById.get(document.folderId)?.displayName ?? "로컬"}</Text>
              <Text style={[styles.meta, { color: theme.secondary }]}>{formatDate(bookmark.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  sortBar: { minHeight: 58, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  searchBox: { flex: 1, flexBasis: 260, minWidth: 180, minHeight: 42, borderWidth: 1, paddingHorizontal: 10, alignItems: "center", flexDirection: "row", borderRadius: 21 },
  searchIcon: { width: 22, fontSize: 16, lineHeight: 20, marginRight: 6, textAlign: "center" },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 0 },
  sortGroup: { width: 210, minHeight: 42, flexShrink: 0, borderWidth: 1, borderRadius: 21, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },
  sortSegment: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  sortSegmentFirst: { borderTopLeftRadius: 17, borderBottomLeftRadius: 17 },
  sortSegmentMiddle: { borderLeftWidth: StyleSheet.hairlineWidth },
  sortSegmentLast: { borderLeftWidth: StyleSheet.hairlineWidth, borderTopRightRadius: 17, borderBottomRightRadius: 17 },
  sortSegmentText: { fontSize: 12, fontWeight: "900" },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18, gap: 10 },
  emptyListContent: { flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pageBadge: { minHeight: 28, paddingHorizontal: 10, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pageBadgeText: { fontSize: 12, fontWeight: "900" },
  preview: { minWidth: 0, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  meta: { flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: "600" },
});
