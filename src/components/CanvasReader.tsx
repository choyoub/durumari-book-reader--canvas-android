import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { BookmarkRecord, DocumentRecord, ReaderSettings } from "../types";
import { createCanvasHtml } from "../viewer/canvasHtml";

interface Props {
  document: DocumentRecord;
  settings: ReaderSettings;
  initialPage: number;
  bookmarks: BookmarkRecord[];
  onReady: (currentPage: number, totalPages: number) => void;
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
  onLoadingProgress?: (payload: { progress: number; message?: string }) => void;
  bookmarkSignal?: number;
  pageRequest?: { signal: number; page: number };
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
  onLoadingProgress,
  bookmarkSignal = 0,
  pageRequest,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(
    () => createCanvasHtml({
      documentId: document.documentId,
      title: document.title,
      text: document.text ?? "",
      initialPage,
      bookmarks: bookmarks.filter((item) => item.documentId === document.documentId).map((item) => item.page),
      settings,
    }),
    [bookmarks, document.documentId, document.text, document.title, initialPage, settings],
  );

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

  function onMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { version: number; type: string; payload: any };
      if (message.version !== 1) return;
      if (message.type === "ready") onReady(message.payload.currentPage, message.payload.totalPages);
      if (message.type === "pageChanged") onPageChanged(message.payload);
      if (message.type === "bookmarkChanged") onBookmarkChanged(message.payload);
      if (message.type === "menuRequested") onMenuRequested?.();
      if (message.type === "loadingProgress") onLoadingProgress?.(message.payload);
    } catch {
      // Unknown WebView payloads are ignored by the bridge contract.
    }
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        originWhitelist={["about:blank"]}
        source={{ html, baseUrl: "about:blank" }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        onShouldStartLoadWithRequest={(request) => request.url === "about:blank"}
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
