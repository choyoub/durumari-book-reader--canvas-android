import React, { useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { DocumentRecord, ReadingRecord } from "../types";
import { formatDate, percent, sortIndicator } from "../lib/listFormat";

export function HistoryScreen({ search, onSearchChange }: { search: string; onSearchChange: (search: string) => void }) {
  const {
    settings,
    documentsById,
    readings,
    foldersById,
    setActiveDocument,
    updateSort,
  } = useAppContext();

  const theme = themeTokens[settings.theme];

  const historyRows = useMemo(() => {
    const joined = readings
      .map((reading) => ({ reading, document: documentsById.get(reading.documentId) }))
      .filter((row): row is { reading: ReadingRecord; document: DocumentRecord } => Boolean(row.document));

    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? joined.filter((row) => row.document.title.toLowerCase().includes(keyword))
      : joined;

    const sort = settings.historySort;
    if (sort.direction === "none") return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.column === "name") return a.document.title.localeCompare(b.document.title, "ko", { numeric: true }) * dir;
      if (sort.column === "progress") return (a.reading.progress - b.reading.progress) * dir;
      return (a.reading.openedAt - b.reading.openedAt) * dir;
    });
  }, [documentsById, readings, settings.historySort, search]);

  return (
    <View style={styles.content}>
      <View style={[styles.sortBar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="히스토리 제목 검색"
            placeholderTextColor={theme.secondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroller} contentContainerStyle={styles.sortControls}>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.historySort.column === "name" ? theme.card : "transparent" }]} onPress={() => void updateSort("history", "name")}>
            <Text style={[styles.sortPillText, { color: settings.historySort.column === "name" ? theme.accentText : theme.secondary }]}>제목{sortIndicator(settings.historySort, "name")}</Text>
          </Pressable>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.historySort.column === "openedAt" ? theme.card : "transparent" }]} onPress={() => void updateSort("history", "openedAt")}>
            <Text style={[styles.sortPillText, { color: settings.historySort.column === "openedAt" ? theme.accentText : theme.secondary }]}>읽은 일자{sortIndicator(settings.historySort, "openedAt")}</Text>
          </Pressable>
          <Pressable style={[styles.sortPill, { borderColor: theme.border, backgroundColor: settings.historySort.column === "progress" ? theme.card : "transparent" }]} onPress={() => void updateSort("history", "progress")}>
            <Text style={[styles.sortPillText, { color: settings.historySort.column === "progress" ? theme.accentText : theme.secondary }]}>진행률{sortIndicator(settings.historySort, "progress")}</Text>
          </Pressable>
        </ScrollView>
      </View>
      <FlatList
        data={historyRows}
        keyExtractor={({ reading }) => reading.documentId}
        contentContainerStyle={historyRows.length ? styles.listContent : styles.emptyListContent}
        ListEmptyComponent={<EmptyState title="최근 읽은 문서가 없습니다." body="문서를 열고 페이지를 넘기면 여기에 기록됩니다." theme={theme} />}
        renderItem={({ item: { reading, document } }) => (
          <Pressable onPress={() => setActiveDocument(document)} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{document.title}</Text>
              <Text style={[styles.progress, { color: theme.accentText }]}>{percent(reading.progress)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text numberOfLines={1} style={[styles.meta, { color: theme.secondary }]}>{foldersById.get(document.folderId)?.displayName ?? "로컬"}</Text>
              <Text style={[styles.meta, { color: theme.secondary }]}>{formatDate(reading.openedAt)}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.max(4, Math.round(reading.progress * 100))}%` }]} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
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
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  progress: { minWidth: 44, textAlign: "right", fontSize: 15, fontWeight: "900" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
});
