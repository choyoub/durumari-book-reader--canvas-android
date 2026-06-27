import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppContext } from "../contexts/AppContext";
import { EmptyState } from "../components/EmptyState";
import { themeTokens } from "../lib/settings";
import { DocumentRecord, ReadingRecord, SortConfig } from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function percent(value = 0) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function formatDate(value?: number) {
  if (!value) return "-";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function HistoryScreen({ search }: { search: string }) {
  const {
    settings,
    documents,
    readings,
    foldersById,
    setActiveDocument,
    updateSort,
  } = useAppContext();

  const theme = themeTokens[settings.theme];

  const historyRows = useMemo(() => {
    const joined = readings
      .map((reading) => ({ reading, document: documents.find((item) => item.documentId === reading.documentId) }))
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
  }, [documents, readings, settings.historySort, search]);

  const sortIndicator = (sort: SortConfig, column: string) => {
    if (sort.column !== column || sort.direction === "none") return "";
    return sort.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <View style={styles.content}>
      {/* Table header */}
      <View style={[styles.tableHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable style={[styles.thCell, { flex: 2 }]} onPress={() => void updateSort("history", "folder")}>
          <Text style={[styles.thText, { color: theme.text }]}>폴더</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 4 }]} onPress={() => void updateSort("history", "name")}>
          <Text style={[styles.thText, { color: settings.historySort.column === "name" ? theme.accent : theme.text }]}>제목{sortIndicator(settings.historySort, "name")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 2.5 }]} onPress={() => void updateSort("history", "openedAt")}>
          <Text style={[styles.thText, { color: settings.historySort.column === "openedAt" ? theme.accent : theme.text, textAlign: "center" }]}>읽은 일자{sortIndicator(settings.historySort, "openedAt")}</Text>
        </Pressable>
        <Pressable style={[styles.thCell, { flex: 1.5 }]} onPress={() => void updateSort("history", "progress")}>
          <Text style={[styles.thText, { color: settings.historySort.column === "progress" ? theme.accent : theme.text, textAlign: "center" }]}>진행률{sortIndicator(settings.historySort, "progress")}</Text>
        </Pressable>
      </View>
      <ScrollView>
        {historyRows.length === 0 ? <EmptyState title="최근 읽은 문서가 없습니다." body="문서를 열고 페이지를 넘기면 여기에 기록됩니다." theme={theme} /> : historyRows.map(({ reading, document }) => (
          <Pressable key={reading.documentId} onPress={() => setActiveDocument(document)} style={[styles.tableRow, { borderColor: theme.border }]}>
            <Text numberOfLines={1} style={[styles.tdCell, { flex: 2, color: theme.secondary }]}>{foldersById.get(document.folderId)?.displayName ?? "로컬"}</Text>
            <Text numberOfLines={1} style={[styles.tdTitle, { flex: 4, color: theme.text }]}>{document.title}</Text>
            <Text style={[styles.tdCell, { flex: 2.5, textAlign: "center", color: theme.secondary }]}>{formatDate(reading.openedAt)}</Text>
            <Text style={[styles.tdCell, { flex: 1.5, textAlign: "center", fontWeight: "600", color: theme.accent }]}>{percent(reading.progress)}</Text>
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
