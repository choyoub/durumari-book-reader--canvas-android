import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { BookmarkRecord, DocumentRecord, SortConfig } from "../types";

function formatDate(value?: number) {
  if (!value) return "-";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function BookmarksScreen({ search }: { search: string }) {
  const {
    settings,
    documents,
    bookmarks,
    foldersById,
    setActiveDocument,
    updateSort,
  } = useAppContext();

  const theme = themeTokens[settings.theme];

  const bookmarkRows = useMemo(() => {
    const joined = bookmarks
      .map((bookmark) => ({ bookmark, document: documents.find((item) => item.documentId === bookmark.documentId) }))
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
  }, [bookmarks, documents, settings.bookmarksSort, search]);

  const sortIndicator = (sort: SortConfig, column: string) => {
    if (sort.column !== column || sort.direction === "none") return "";
    return sort.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <View style={styles.content}>
      {/* Table header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable style={[styles.thCell, { flex: 2 }]} onPress={() => void updateSort("bookmarks", "folder")}>
          <Text style={[styles.thText, { color: theme.text }]}>폴더</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 4 }]} onPress={() => void updateSort("bookmarks", "bookTitle")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "bookTitle" ? theme.accent : theme.text }]}>제목{sortIndicator(settings.bookmarksSort, "bookTitle")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 2.5 }]} onPress={() => void updateSort("bookmarks", "createdAt")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "createdAt" ? theme.accent : theme.text, textAlign: "center" }]}>추가 일자{sortIndicator(settings.bookmarksSort, "createdAt")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 1.5 }]} onPress={() => void updateSort("bookmarks", "page")}>
          <Text style={[styles.thText, { color: settings.bookmarksSort.column === "page" ? theme.accent : theme.text, textAlign: "center" }]}>위치{sortIndicator(settings.bookmarksSort, "page")}</Text>
        </Pressable>
      </View>
      <ScrollView>
        {bookmarkRows.length === 0 ? <EmptyState title="책갈피가 없습니다." body="뷰어에서 책갈피를 추가하면 이곳에서 바로 이동할 수 있습니다." theme={theme} /> : bookmarkRows.map(({ bookmark, document }) => (
          <Pressable key={bookmark.bookmarkId} onPress={() => setActiveDocument(document)} style={[styles.tableRow, { borderColor: theme.border }]}>
            <Text numberOfLines={1} style={[styles.tdCell, { flex: 2, color: theme.secondary }]}>{foldersById.get(document.folderId)?.displayName ?? "로컬"}</Text>
            <Text numberOfLines={1} style={[styles.tdTitle, { flex: 4, color: theme.text }]}>{document.title}</Text>
            <Text style={[styles.tdCell, { flex: 2.5, textAlign: "center", color: theme.secondary }]}>{formatDate(bookmark.createdAt)}</Text>
            <Text style={[styles.tdCell, { flex: 1.5, textAlign: "center", fontWeight: "600", color: theme.accent }]}>p.{bookmark.page}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
