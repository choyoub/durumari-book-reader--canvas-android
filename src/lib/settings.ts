import type { ReaderSettings, ThemeName } from "../types";

export const READER_FONTS = [
  { label: "나눔고딕", value: "NanumGothic, 'Malgun Gothic', sans-serif", native: "NanumGothic" },
  { label: "Noto Serif KR", value: "NotoSerifKR, 'Noto Serif KR', serif", native: "NotoSerifKR" },
  { label: "Noto Sans KR", value: "NotoSansKR, 'Noto Sans KR', sans-serif", native: "NotoSansKR" },
  { label: "마루부리", value: "MaruBuri, 'Noto Serif KR', serif", native: "MaruBuri" },
  { label: "도현체", value: "DoHyeon, 'Malgun Gothic', sans-serif", native: "DoHyeon" },
  { label: "고운돋움", value: "GowunDodum, 'Malgun Gothic', sans-serif", native: "GowunDodum" },
  { label: "IBM Plex Serif KR", value: "IBMPlexSerifKR, 'Noto Serif KR', serif", native: "IBMPlexSerifKR" },
  { label: "프리텐다드", value: "Pretendard, 'Noto Sans KR', sans-serif", native: "Pretendard" },
  { label: "스포카 한 산스 Neo", value: "SpoqaHanSansNeo, 'Noto Sans KR', sans-serif", native: "SpoqaHanSansNeo" },
  { label: "KoPubWorld 바탕체", value: "KoPubWorldBatang, 'Noto Serif KR', serif", native: "KoPubWorldBatang" },
  { label: "리디바탕", value: "RidiBatang, 'Noto Serif KR', serif", native: "RidiBatang" },
] as const;

export const defaultSettings: ReaderSettings = {
  activeFolderId: null,
  fontFamily: "NanumGothic, 'Malgun Gothic', sans-serif",
  fontSize: 18,
  isBold: false,
  lineHeight: 1.6,
  letterSpacing: 0,
  paddingTop: 40,
  paddingBottom: 40,
  paddingLeft: 20,
  paddingRight: 20,
  paddingLinked: true,
  pageTurnTouch: true,
  pageTurnSwipe: true,
  pageTurnVolume: true,
  volumeKeyPaging: true,
  pageTurnFeedback: "vibration",
  pageTurnStyle: "curl",
  hideCompleted: false,
  theme: "paper",
  librarySort: { column: "modifiedAt", direction: "desc" },
  historySort: { column: "openedAt", direction: "desc" },
  bookmarksSort: { column: "createdAt", direction: "desc" },
};

export const themeTokens: Record<ThemeName, {
  bg: string;
  outer: string;
  card: string;
  statusBar: string;
  navigationBar: string;
  statusBarStyle: "light" | "dark";
  navigationBarStyle: "light" | "dark";
  text: string;
  secondary: string;
  border: string;
  accent: string;
  accentText: string;
  accentForeground: string;
  danger: string;
  unread: string;
  reading: string;
  completed: string;
}> = {
  paper: {
    bg: "#f2ead3",
    outer: "#cfbe90",
    card: "#eae0c4",
    statusBar: "#cfbe90",
    navigationBar: "#cfbe90",
    statusBarStyle: "dark",
    navigationBarStyle: "dark",
    text: "#2a2a2a",
    secondary: "#2a2a2a80",
    border: "#d5c5a0",
    accent: "#9a5a10",
    accentText: "#9a5a10",
    accentForeground: "#FFFFFF",
    danger: "#B3342D",
    unread: "#2a2a2a80",
    reading: "#9a5a10",
    completed: "#476B3C",
  },
  light: {
    bg: "#f8f4ed",
    outer: "#e2dbcc",
    card: "#FFFFFF",
    statusBar: "#e2dbcc",
    navigationBar: "#e2dbcc",
    statusBarStyle: "dark",
    navigationBarStyle: "dark",
    text: "#1a1a2e",
    secondary: "#1a1a2e80",
    border: "#e0d8c8",
    accent: "#2563eb",
    accentText: "#2563eb",
    accentForeground: "#FFFFFF",
    danger: "#B3261E",
    unread: "#1a1a2e80",
    reading: "#2563eb",
    completed: "#217A3C",
  },
  dark: {
    bg: "#121212",
    outer: "#090909",
    card: "#1e1e1e",
    statusBar: "#090909",
    navigationBar: "#090909",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#e0e0e0",
    secondary: "#e0e0e080",
    border: "#2d2d2d",
    accent: "#8ab4f8",
    accentText: "#8ab4f8",
    accentForeground: "#121212",
    danger: "#FFB4AB",
    unread: "#e0e0e080",
    reading: "#8ab4f8",
    completed: "#72C48A",
  },
  chalk: {
    bg: "#183b32",
    outer: "#0d241f",
    card: "#21483e",
    statusBar: "#0d241f",
    navigationBar: "#0d241f",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#f1ead0",
    secondary: "#f1ead094",
    border: "#3b665b",
    accent: "#f3c969",
    accentText: "#f3c969",
    accentForeground: "#183b32",
    danger: "#F1A6A6",
    unread: "#f1ead094",
    reading: "#f3c969",
    completed: "#B7D7A8",
  },
};

export function nativeFontFamily(fontFamily: string) {
  return READER_FONTS.find((font) => font.value === fontFamily)?.native ?? "NanumGothic";
}

export function resolveActiveFolderId(folderIds: string[], savedFolderId: string | null) {
  if (!folderIds.length) return savedFolderId;
  return savedFolderId && folderIds.includes(savedFolderId) ? savedFolderId : folderIds[0];
}
