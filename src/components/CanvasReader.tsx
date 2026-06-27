import { useEffect, useMemo, useRef } from "react";
import { useAssets } from "expo-asset";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { BookmarkRecord, DocumentRecord, ReaderSettings } from "../types";
import { nativeFontFamily } from "../lib/settings";
import { createCanvasHtml } from "../viewer/canvasHtml";

const VIEWER_FONT_ASSETS = [
  ["NanumGothic", require("../../assets/fonts/NanumGothic.ttf")],
  ["NotoSerifKR", require("../../assets/fonts/NotoSerifKR.ttf")],
  ["NotoSansKR", require("../../assets/fonts/NotoSansKR.ttf")],
  ["MaruBuri", require("../../assets/fonts/MaruBuri.ttf")],
  ["DoHyeon", require("../../assets/fonts/DoHyeon.ttf")],
  ["GowunDodum", require("../../assets/fonts/GowunDodum.ttf")],
  ["IBMPlexSerifKR", require("../../assets/fonts/IBMPlexSerifKR.ttf")],
  ["Pretendard", require("../../assets/fonts/Pretendard.ttf")],
  ["SpoqaHanSansNeo", require("../../assets/fonts/SpoqaHanSansNeo.ttf")],
  ["KoPubWorldBatang", require("../../assets/fonts/KoPubWorldBatang.otf")],
  ["RidiBatang", require("../../assets/fonts/RidiBatang.otf")],
] as const;

interface Props {
  document: DocumentRecord;
  settings: ReaderSettings;
  initialPage: number;
  bookmarks: BookmarkRecord[];
  onReady: (currentPage: number, totalPages: number, offset: number) => void;
  onPageChanged: (payload: {
    currentPage: number;
    totalPages: number;
    progress: number;
    completed?: boolean;
    preview?: string;
    boundary?: boolean;
  }) => void;
  onBookmarkChanged: (payload: {
    active: boolean;
    page: number;
    totalPages: number;
    progress: number;
    preview: string;
  }) => void;
  onMenuRequested?: () => void;
  onBackRequested?: () => void;
  onLoadingProgress?: (payload: { progress: number; message?: string }) => void;
  bookmarkSignal?: number;
  pageRequest?: { signal: number; page: number };
  offsetRequest?: { signal: number; offset: number };
  onError?: (payload: { code: string; message: string }) => void;
}

export function CanvasReader({
  document,
  settings,
  initialPage,
  bookmarks,
  onReady,
  onPageChanged,
  onBookmarkChanged,
  onMenuRequested,
  onBackRequested,
  onLoadingProgress,
  bookmarkSignal = 0,
  pageRequest,
  offsetRequest,
  onError,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const selectedFontAsset = useMemo(() => {
    const selectedFont = nativeFontFamily(settings.fontFamily);
    return VIEWER_FONT_ASSETS.find(([name]) => name === selectedFont) ?? VIEWER_FONT_ASSETS[0];
  }, [settings.fontFamily]);
  const [fontAssets, fontAssetError] = useAssets([selectedFontAsset[1]]);
  const fontUris = useMemo(() => {
    const uri = fontAssets?.[0]?.localUri ?? fontAssets?.[0]?.uri;
    return uri ? { [selectedFontAsset[0]]: uri } : undefined;
  }, [fontAssets, selectedFontAsset]);
  const html = useMemo(
    () => createCanvasHtml({
      documentId: document.documentId,
      title: document.title,
      text: document.text ?? "",
      initialPage,
      bookmarks: bookmarks.filter((item) => item.documentId === document.documentId).map((item) => item.page),
      settings,
      fontUris,
    }),
    [document.documentId, document.text, document.title, fontUris],
  );

  const prevSettings = useRef(settings);
  useEffect(() => {
    if (prevSettings.current === settings) return;
    prevSettings.current = settings;
    webViewRef.current?.postMessage(JSON.stringify({
      version: 1,
      type: "updateSettings",
      requestId: `settings-${Date.now()}`,
      payload: settings,
    }));
  }, [settings]);

  useEffect(() => {
    if (!bookmarkSignal) return;
    webViewRef.current?.postMessage(JSON.stringify({
      version: 1,
      type: "toggleBookmark",
      requestId: `bookmark-${bookmarkSignal}`,
      payload: {},
    }));
  }, [bookmarkSignal]);

  useEffect(() => {
    if (!pageRequest?.signal) return;
    webViewRef.current?.postMessage(JSON.stringify({
      version: 1,
      type: "goToPage",
      requestId: `go-page-${pageRequest.signal}`,
      payload: { page: pageRequest.page },
    }));
  }, [pageRequest]);

  useEffect(() => {
    if (!offsetRequest?.signal) return;
    webViewRef.current?.postMessage(JSON.stringify({
      version: 1,
      type: "goToOffset",
      requestId: `go-offset-${offsetRequest.signal}`,
      payload: { offset: offsetRequest.offset },
    }));
  }, [offsetRequest]);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { version: number; type: string; payload: any };
      if (message.version !== 1) return;
      if (message.type === "ready") onReady(message.payload.currentPage, message.payload.totalPages, message.payload.offset);
      if (message.type === "pageChanged") onPageChanged(message.payload);
      if (message.type === "bookmarkChanged") onBookmarkChanged(message.payload);
      if (message.type === "menuRequested") onMenuRequested?.();
      if (message.type === "backRequested") onBackRequested?.();
      if (message.type === "loadingProgress") onLoadingProgress?.(message.payload);
      if (message.type === "error") onError?.(message.payload);
    } catch {
      // Unknown WebView payloads are ignored by the bridge contract.
    }
  }

  if (!fontAssets && !fontAssetError) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "about:blank" }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs={false}
        onMessage={onMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webview: { flex: 1, backgroundColor: "transparent" },
});
