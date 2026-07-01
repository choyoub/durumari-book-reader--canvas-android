import React, { useEffect, useMemo, useRef } from "react";
import { useAssets } from "expo-asset";
import { StyleSheet, View } from "react-native";
import type { BookmarkRecord, DocumentRecord, ReaderSettings, ReadingRecord } from "../types";
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

const VIEWER_FONT_MODULES = VIEWER_FONT_ASSETS.map(([, asset]) => asset);

function createSettingsKey(settings: ReaderSettings) {
  return JSON.stringify({
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    isBold: settings.isBold,
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    paddingTop: settings.paddingTop,
    paddingBottom: settings.paddingBottom,
    paddingLeft: settings.paddingLeft,
    paddingRight: settings.paddingRight,
    pageTurnTouch: settings.pageTurnTouch,
    pageTurnSwipe: settings.pageTurnSwipe,
    pageTurnFeedback: settings.pageTurnFeedback,
    pageTurnStyle: settings.pageTurnStyle,
    theme: settings.theme,
  });
}

interface Props {
  document: DocumentRecord;
  settings: ReaderSettings;
  initialPage: number;
  reading?: ReadingRecord | null;
  bookmarks: BookmarkRecord[];
  targetBookmarkId?: string | null;
  onReady: (currentPage: number, totalPages: number, offset: number) => void;
  onPageChanged: (payload: {
    currentPage: number;
    totalPages: number;
    progress: number;
    completed?: boolean;
    preview?: string;
    boundary?: boolean;
    offset?: number;
  }) => void;
  onBookmarkChanged: (payload: {
    active: boolean;
    page: number;
    totalPages: number;
    progress: number;
    preview: string;
    bookmarkId?: string;
    anchorOffset?: number | null;
  }) => void;
  onReadingSynced?: (payload: { reading: ReadingRecord }) => Promise<void> | void;
  onBookmarksSynced?: (payload: { bookmarks: BookmarkRecord[] }) => Promise<void> | void;
  onMenuRequested?: () => void;
  onBackRequested?: () => void;
  onLoadingProgress?: (payload: { progress: number; message?: string }) => void;
  bookmarkSignal?: number;
  pageRequest?: { signal: number; page: number };
  turnRequest?: { signal: number; delta: -1 | 1 };
  offsetRequest?: { signal: number; offset: number };
  onError?: (payload: { code: string; message: string }) => void;
}

export function CanvasReader(props: Props) {
  const {
    document,
    settings,
    initialPage,
    reading,
    bookmarks,
    targetBookmarkId,
    onReady,
    onPageChanged,
    onBookmarkChanged,
    onReadingSynced,
    onBookmarksSynced,
    onMenuRequested,
    onBackRequested,
    onLoadingProgress,
    bookmarkSignal = 0,
    pageRequest,
    turnRequest,
    offsetRequest,
    onError,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [fontAssets, fontAssetError] = useAssets(VIEWER_FONT_MODULES);
  const fontUris = useMemo(() => {
    if (!fontAssets) return undefined;
    return fontAssets.reduce<Record<string, string>>((uris, asset, index) => {
      const uri = asset.localUri ?? asset.uri;
      if (uri) uris[VIEWER_FONT_ASSETS[index][0]] = uri;
      return uris;
    }, {});
  }, [fontAssets]);
  const settingsKey = useMemo(() => createSettingsKey(settings), [settings]);
  const initialReadingRef = useRef<ReadingRecord | null | undefined>(undefined);
  if (initialReadingRef.current === undefined) {
    initialReadingRef.current = reading ?? null;
  }
  const initialBookmarksRef = useRef<BookmarkRecord[] | null>(null);
  if (initialBookmarksRef.current === null) {
    initialBookmarksRef.current = bookmarks.filter((item) => item.documentId === document.documentId);
  }
  const pendingSyncRef = useRef<Promise<void> | null>(null);
  const html = useMemo(
    () => createCanvasHtml({
      documentId: document.documentId,
      title: document.title,
      text: document.text ?? "",
      initialPage,
      reading: initialReadingRef.current,
      bookmarks: initialBookmarksRef.current ?? [],
      targetBookmarkId,
      settings,
      fontUris,
      settingsKey,
    }),
    [document.documentId, document.text, document.title, fontUris, targetBookmarkId],
  );

  function postToReader(type: string, requestId: string, payload: unknown) {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
      version: 1,
      type,
      requestId,
      payload,
    }), "*");
  }

  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      try {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const message = JSON.parse(event.data) as { version: number; type: string; payload: any };
        if (message.version !== 1) return;
        if (message.type === "readingSynced") {
          pendingSyncRef.current = Promise.resolve(onReadingSynced?.(message.payload))
            .then(() => undefined)
            .catch(() => undefined);
          await pendingSyncRef.current;
        }
        if (message.type === "bookmarksSynced") {
          pendingSyncRef.current = Promise.resolve(onBookmarksSynced?.(message.payload))
            .then(() => undefined)
            .catch(() => undefined);
          await pendingSyncRef.current;
        }
        if (message.type === "ready") {
          if (message.payload?.settingsKey !== settingsKey) return;
          if (pendingSyncRef.current) await pendingSyncRef.current;
          onReady(message.payload.currentPage, message.payload.totalPages, message.payload.offset);
        }
        if (message.type === "pageChanged") onPageChanged(message.payload);
        if (message.type === "bookmarkChanged") onBookmarkChanged(message.payload);
        if (message.type === "menuRequested") onMenuRequested?.();
        if (message.type === "backRequested") onBackRequested?.();
        if (message.type === "loadingProgress") onLoadingProgress?.(message.payload);
        if (message.type === "error") onError?.(message.payload);
      } catch {
        // Unknown iframe payloads are ignored by the bridge contract.
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    onBackRequested,
    onBookmarkChanged,
    onBookmarksSynced,
    onError,
    onLoadingProgress,
    onMenuRequested,
    onPageChanged,
    onReady,
    onReadingSynced,
    settingsKey,
  ]);

  const prevSettings = useRef(settings);
  useEffect(() => {
    if (prevSettings.current === settings) return;
    prevSettings.current = settings;
    postToReader("updateSettings", `settings-${Date.now()}`, { settings, settingsKey });
  }, [settings, settingsKey]);

  useEffect(() => {
    if (!bookmarkSignal) return;
    postToReader("toggleBookmark", `bookmark-${bookmarkSignal}`, {});
  }, [bookmarkSignal]);

  useEffect(() => {
    if (!pageRequest?.signal) return;
    postToReader("goToPage", `go-page-${pageRequest.signal}`, { page: pageRequest.page });
  }, [pageRequest]);

  useEffect(() => {
    if (!turnRequest?.signal) return;
    postToReader("turnPage", `turn-page-${turnRequest.signal}`, { delta: turnRequest.delta, axis: "horizontal" });
  }, [turnRequest]);

  useEffect(() => {
    if (!offsetRequest?.signal) return;
    postToReader("goToOffset", `go-offset-${offsetRequest.signal}`, { offset: offsetRequest.offset });
  }, [offsetRequest]);

  useEffect(() => {
    return () => postToReader("disposeDocument", `dispose-${Date.now()}`, {});
  }, []);

  if (!fontAssets && !fontAssetError) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      {React.createElement("iframe", {
        ref: iframeRef,
        srcDoc: html,
        title: document.title,
        style: iframeStyle,
      })}
    </View>
  );
}

const iframeStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0,
  display: "block",
  background: "transparent",
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
