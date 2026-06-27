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
  danger: string;
  unread: string;
  reading: string;
  completed: string;
}> = {
  paper: {
    bg: "#F2EAD3",
    outer: "#CFBE90",
    card: "#EAE0C4",
    statusBar: "#9A5A10",
    navigationBar: "#9A5A10",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#2A2A2A",
    secondary: "#6F6856",
    border: "#D5C5A0",
    accent: "#9A5A10",
    accentText: "#9A5A10",
    danger: "#B3342D",
    unread: "#6F6856",
    reading: "#9A5A10",
    completed: "#476B3C",
  },
  light: {
    bg: "#F7F8FA",
    outer: "#E5E7EB",
    card: "#FFFFFF",
    statusBar: "#4B5563",
    navigationBar: "#4B5563",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#111827",
    secondary: "#6B7280",
    border: "#E5E7EB",
    accent: "#4B5563",
    accentText: "#4B5563",
    danger: "#B3261E",
    unread: "#6B7280",
    reading: "#4B5563",
    completed: "#217A3C",
  },
  dark: {
    bg: "#181A1F",
    outer: "#0F1115",
    card: "#24272E",
    statusBar: "#0F1115",
    navigationBar: "#0F1115",
    statusBarStyle: "light",
    navigationBarStyle: "light",
    text: "#F3F4F6",
    secondary: "#AEB4BE",
    border: "#343842",
    accent: "#0F1115",
    accentText: "#D1D5DB",
    danger: "#FFB4AB",
    unread: "#AEB4BE",
    reading: "#F3F4F6",
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
