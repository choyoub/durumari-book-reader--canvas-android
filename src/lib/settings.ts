import type { ReaderSettings, ThemeName } from "../types";

export const READER_FONTS = [
  { label: "나눔명조", value: "NanumMyeongjo, 'Malgun Gothic', serif", native: "NanumMyeongjo" },
  { label: "나눔고딕", value: "NanumGothic, 'Malgun Gothic', sans-serif", native: "NanumGothic" },
  { label: "리디바탕", value: "RidiBatang, 'Noto Serif KR', serif", native: "RidiBatang" },
  { label: "마루부리", value: "MaruBuri, 'Noto Serif KR', serif", native: "MaruBuri" },
  { label: "프리텐다드", value: "Pretendard, 'Noto Sans KR', sans-serif", native: "Pretendard" },
] as const;

export const defaultSettings: ReaderSettings = {
  fontFamily: "NanumMyeongjo, 'Malgun Gothic', serif",
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
  return READER_FONTS.find((font) => font.value === fontFamily)?.native ?? "NanumMyeongjo";
}
