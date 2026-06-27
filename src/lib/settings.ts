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
  danger: string;
  unread: string;
  reading: string;
  completed: string;
}> = {
  paper: {
    bg: "#F2EAD3",
    outer: "#CFBE90",
    card: "#EAE0C4",
    statusBar: "#3E493D",
    navigationBar: "#CFBE90",
    statusBarStyle: "light",
    navigationBarStyle: "dark",
    text: "#2A2A2A",
    secondary: "#6F6856",
    border: "#D5C5A0",
    accent: "#9A5A10",
    danger: "#B3342D",
    unread: "#6F6856",
    reading: "#9A5A10",
    completed: "#476B3C",
  },
  light: {
    bg: "#F8F4ED",
    outer: "#E2DBCC",
    card: "#FFFFFF",
    statusBar: "#263746",
    navigationBar: "#E2DBCC",
    statusBarStyle: "light",
    navigationBarStyle: "dark",
    text: "#1A1A2E",
    secondary: "#666666",
    border: "#E0D8C8",
    accent: "#B85C00",
    danger: "#B3261E",
    unread: "#666666",
    reading: "#B85C00",
    completed: "#217A3C",
  },
  dark: {
    bg: "#121212",
    outer: "#090909",
    card: "#1E1E1E",
    statusBar: "#090909",
    navigationBar: "#181818",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#E0E0E0",
    secondary: "#A8A8A8",
    border: "#2D2D2D",
    accent: "#FF9D00",
    danger: "#FFB4AB",
    unread: "#A8A8A8",
    reading: "#FF9D00",
    completed: "#72C48A",
  },
};

export function nativeFontFamily(fontFamily: string) {
  return READER_FONTS.find((font) => font.value === fontFamily)?.native ?? "NanumGothic";
}

export function resolveActiveFolderId(folderIds: string[], savedFolderId: string | null) {
  if (!folderIds.length) return savedFolderId;
  return savedFolderId && folderIds.includes(savedFolderId) ? savedFolderId : folderIds[0];
}
