import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, DeviceEventEmitter, Modal, NativeModules, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";

import { CanvasReader } from "../components/CanvasReader";
import { ScrollArtwork } from "../components/IntroScroll";
import { ResponsiveBottomSheet, ResponsiveDialogSurface, ResponsiveFrame } from "../components/ResponsiveFrame";
import { ThemedScreen } from "../components/ThemedScreen";
import { useAppContext } from "../contexts/AppContext";
import { BookmarkRecord, DocumentRecord, ReadingRecord } from "../types";
import { themeTokens } from "../lib/settings";
import { toggleBookmark, saveReading, getDocumentText, upsertDocuments, syncBookmarks } from "../lib/store";
import { hydrateDocumentFromBytes } from "../lib/documentImport";
import { readSafBytes } from "../lib/safImport";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeBookmarkId(documentId: string, page: number) {
  return `${documentId}:p${page}:${Date.now()}`;
}

async function loadViewerDocument(document: DocumentRecord, forceEncoding?: string) {
  if (!forceEncoding) {
    const stored = await getDocumentText(document.documentId);
    if (stored.text !== undefined) return { ...document, ...stored };
  }

  const bytes = await readSafBytes(document.sourceUri);
  const hydrated = await hydrateDocumentFromBytes(document, bytes, forceEncoding);
  await upsertDocuments([hydrated]);
  return hydrated;
}

// ----------------- Viewer Modals -----------------

function ViewerMenuModal({
  visible, title, current, total, theme, onClose, onBookmark, onNavigate, onSettings, onExit, hasToc, onToc, onEncodingChange,
}: any) {
  const dragY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        dragY.stopAnimation();
        dragY.setValue(0);
      },
      onPanResponderMove: (_event, gesture) => {
        dragY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 78 || (gesture.dy > 28 && gesture.vy > 0.9)) {
          Animated.timing(dragY, {
            toValue: 420,
            duration: 170,
            useNativeDriver: true,
          }).start(() => {
            dragY.setValue(0);
            onCloseRef.current();
          });
          return;
        }
        Animated.spring(dragY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;
  const ratio = total <= 1 ? 0 : (current - 1) / Math.max(1, total - 1);
  return (
    <ResponsiveBottomSheet
      visible={visible}
      theme={theme}
      onRequestClose={onClose}
      animatedStyle={{ transform: [{ translateY: dragY }] }}
    >
      {(metrics) => (
          <View style={[styles.viewerMenu, { maxHeight: metrics.bottomSheetMaxHeight, backgroundColor: theme.card, borderColor: theme.border }]}>
            <View
              style={styles.sheetDragArea}
              accessibilityRole="button"
              accessibilityLabel="아래로 스와이프해서 메뉴 닫기"
              {...dragResponder.panHandlers}
            >
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            </View>
            <View style={styles.modalTitle}>
              <View style={styles.readerTitleWrap}>
                <Text numberOfLines={1} style={[styles.modalHeading, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.readerMeta, { color: theme.secondary }]}>p.{current} / {total}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={4} accessibilityRole="button" accessibilityLabel="메뉴 닫기">
                <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
              </Pressable>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.round(ratio * 100)}%` }]} />
            </View>
            <View style={styles.viewerActions}>
              <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onBookmark} accessibilityRole="button">
                <Text style={styles.viewerActionIcon}>🔖</Text>
                <Text style={{ color: theme.text }}>책갈피</Text>
              </Pressable>
              <Pressable
                style={[styles.viewerAction, { borderColor: theme.border, opacity: hasToc ? 1 : 0.4 }]}
                onPress={onToc}
                disabled={!hasToc}
                accessibilityRole="button"
              >
                <Text style={styles.viewerActionIcon}>📑</Text>
                <Text style={{ color: theme.text }}>목차</Text>
              </Pressable>
              <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onNavigate} accessibilityRole="button">
                <Text style={styles.viewerActionIcon}>🧭</Text>
                <Text style={{ color: theme.text }}>이동</Text>
              </Pressable>
              <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onEncodingChange} accessibilityRole="button">
                <Text style={styles.viewerActionIcon}>🔤</Text>
                <Text style={{ color: theme.text }}>인코딩</Text>
              </Pressable>
              <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onSettings} accessibilityRole="button">
                <Text style={styles.viewerActionIcon}>⚙️</Text>
                <Text style={{ color: theme.text }}>설정</Text>
              </Pressable>
              <Pressable style={[styles.viewerAction, { borderColor: theme.border }]} onPress={onExit} accessibilityRole="button">
                <Text style={styles.viewerActionIcon}>📚</Text>
                <Text style={{ color: theme.text }}>목록</Text>
              </Pressable>
            </View>
          </View>
      )}
    </ResponsiveBottomSheet>
  );
}

function ViewerLoadingOverlay({ theme, progress, message, error, onRetry, onClose, onAnimationComplete }: any) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  if (error) {
    return (
      <View style={[styles.viewerLoading, { backgroundColor: theme.outer }]}>
        <View style={[styles.viewerErrorPanel, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Text style={{ color: theme.accentText, fontSize: 18, marginBottom: 8, fontWeight: "700" }}>문서를 열 수 없습니다</Text>
          <Text style={{ fontSize: 14, color: theme.secondary, marginBottom: 24, textAlign: "center" }}>{error.message}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable style={[styles.popupButton, { borderColor: theme.border, flex: 1, alignItems: "center" }]} onPress={onClose}>
              <Text style={{ color: theme.text }}>목록으로</Text>
            </Pressable>
            <Pressable style={[styles.popupButton, { borderColor: theme.border, backgroundColor: theme.accent, flex: 1, alignItems: "center" }]} onPress={onRetry}>
              <Text style={{ color: theme.accentForeground, fontWeight: "700" }}>다시 시도</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.viewerLoading, { backgroundColor: theme.outer }]}>
      <View style={styles.viewerLoadingArtwork}>
        <ScrollArtwork onAnimationComplete={onAnimationComplete} />
      </View>
      <View style={styles.viewerLoadingFooter}>
        <Text style={[styles.viewerLoadingTitle, { color: theme.text }]}>문서를 펼치는 중</Text>
        <View style={[styles.viewerLoadingTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.viewerLoadingFill,
              { backgroundColor: theme.accent, width: `${Math.round(safeProgress * 100)}%` },
            ]}
          />
        </View>
        <Text style={[styles.viewerLoadingText, { color: theme.secondary }]}>
          {message.includes("%") ? message : `${message} ${Math.round(safeProgress * 100)}%`}
        </Text>
      </View>
    </View>
  );
}

function TocModal({ visible, toc, theme, onClose, onSelect }: any) {
  return (
    <ResponsiveBottomSheet visible={visible} theme={theme} onRequestClose={onClose}>
      {(metrics) => (
          <View style={[styles.settingsSheet, { backgroundColor: theme.card, borderColor: theme.border, maxHeight: metrics.bottomSheetMaxHeight }]}>
            <View style={styles.modalTitle}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>목차</Text>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={4} accessibilityRole="button" accessibilityLabel="목차 닫기">
                <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {toc?.map((item: any, index: number) => (
                <Pressable
                  key={index}
                  style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}
                  onPress={() => onSelect(item.charOffset)}
                >
                  <Text style={{ color: theme.text, fontSize: 16 }}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
      )}
    </ResponsiveBottomSheet>
  );
}

function PageMoveSlider({ page, total, theme, onChange }: any) {
  const sliderRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackLeftRef = useRef(0);
  const maxPage = Math.max(1, total);
  const safePage = clamp(Math.round(Number(page) || 1), 1, maxPage);
  const ratio = maxPage <= 1 ? 0 : (safePage - 1) / (maxPage - 1);

  const updateFromPageX = useCallback((pageX: number) => {
    if (trackWidth <= 0) return;
    const x = pageX - trackLeftRef.current;
    const nextRatio = clamp(x / trackWidth, 0, 1);
    const nextPage = clamp(Math.round(nextRatio * (maxPage - 1)) + 1, 1, maxPage);
    onChange(String(nextPage));
  }, [maxPage, onChange, trackWidth]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const pageX = event.nativeEvent.pageX;
      sliderRef.current?.measureInWindow((x) => {
        trackLeftRef.current = x;
        updateFromPageX(pageX);
      });
    },
    onPanResponderMove: (event) => updateFromPageX(event.nativeEvent.pageX),
  });

  return (
    <View
      ref={sliderRef}
      style={styles.pageSliderRow}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 1, max: maxPage, now: safePage }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
        onChange(String(clamp(safePage + delta, 1, maxPage)));
      }}
    >
      <View style={[styles.pageSliderTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.pageSliderFill, { backgroundColor: theme.accent, width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.pageSliderThumb, { borderColor: theme.accent, backgroundColor: theme.card, left: `${ratio * 100}%` }]} />
    </View>
  );
}

function PageNavigatorModal({ visible, current, total, value, bookmarks, theme, onChange, onClose, onGo }: any) {
  const numeric = clamp(Number(value) || current, 1, Math.max(1, total));
  const sorted = [...bookmarks].sort((a: any, b: any) => a.page - b.page);
  const previous = [...sorted].reverse().find((item) => item.page < current);
  const next = sorted.find((item) => item.page > current);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.centerBackdrop}>
        <ResponsiveDialogSurface theme={theme} maxWidth={420}>
          <View style={styles.modalTitle}>
            <Text style={[styles.modalHeading, { color: theme.text }]}>페이지 이동</Text>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={4} accessibilityRole="button" accessibilityLabel="화면 이동 닫기">
              <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
            </Pressable>
          </View>
          <View style={styles.pageInputRow}>
            <TextInput
              value={value}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              style={[styles.pageInput, { color: theme.text, borderColor: theme.border }]}
            />
            <Text style={{ color: theme.secondary }}>/ {total}</Text>
          </View>
          <PageMoveSlider page={numeric} total={total} theme={theme} onChange={onChange} />
          <View style={styles.quickGrid}>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={() => onGo(1)}>
              <Text style={{ color: theme.text }}>처음</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border, opacity: previous ? 1 : .45 }]} disabled={!previous} onPress={() => previous && onGo(previous.page, { keepOpen: true })}>
              <Text style={{ color: theme.text }}>이전 책갈피</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { borderColor: theme.border, opacity: next ? 1 : .45 }]} disabled={!next} onPress={() => next && onGo(next.page, { keepOpen: true })}>
              <Text style={{ color: theme.text }}>다음 책갈피</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onGo(numeric)} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <Text style={[styles.accentButtonText, { color: theme.accentForeground }]}>이동하기</Text>
          </Pressable>
          <Text style={[styles.pageHint, { color: theme.secondary }]}>현재 p.{current}</Text>
        </ResponsiveDialogSurface>
      </View>
    </Modal>
  );
}

// ----------------- Main Viewer Screen -----------------

type ViewerModal = "menu" | "encoding" | "toc" | "pageNavigator";

export function ViewerScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const {
    settings,
    activeDocument,
    setActiveDocument,
    activeViewerTarget,
    openDocument,
    readingsById,
    bookmarks,
    refresh,
    upsertReadingState,
    setBookmarkState,
    syncBookmarkState,
  } = useAppContext();

  const theme = themeTokens[settings.theme];

  const [viewerLoading, setViewerLoading] = useState<{ active: boolean; progress: number; message: string; error?: { code: string; message: string } }>({
    active: true,
    progress: 0,
    message: "전체 페이지를 계산하는 중...",
  });
  const [viewerReady, setViewerReady] = useState(false);
  const viewerHasLoadedRef = useRef(false);
  
  const activeReading = activeDocument ? readingsById.get(activeDocument.documentId) : null;
  const targetBookmark = activeViewerTarget?.type === "bookmark"
    ? bookmarks.find((item) => item.bookmarkId === activeViewerTarget.bookmarkId)
    : null;
  const initialPage = targetBookmark?.page || activeReading?.lastPage || 1;
  const [viewerPage, setViewerPage] = useState({ current: initialPage, total: 1, offset: 0 });
  const [bookmarkSignal, setBookmarkSignal] = useState(0);
  const [activeModal, setActiveModal] = useState<ViewerModal | null>(null);
  const [pageDraft, setPageDraft] = useState("1");
  const [pageRequest, setPageRequest] = useState<{ signal: number; page: number }>({ signal: 0, page: 1 });
  const [turnRequest, setTurnRequest] = useState<{ signal: number; delta: -1 | 1 }>({ signal: 0, delta: 1 });
  const [offsetRequest, setOffsetRequest] = useState<{ signal: number; offset: number }>({ signal: 0, offset: 0 });
  const [loadAttempt, setLoadAttempt] = useState(0);

  const closeTopViewerLayer = useCallback(() => {
    if (activeModal) {
      setActiveModal(null);
    } else {
      setActiveDocument(null);
    }
    return true;
  }, [activeModal, setActiveDocument]);

  const openViewerModal = useCallback((modal: ViewerModal) => {
    setActiveModal(null);
    requestAnimationFrame(() => setActiveModal(modal));
  }, []);

  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", closeTopViewerLayer);

    return () => {
      backSub.remove();
    };
  }, [closeTopViewerLayer]);

  useEffect(() => {
    const document = activeDocument;
    if (!document || document.text !== undefined) return;

    let cancelled = false;
    viewerHasLoadedRef.current = false;
    setViewerReady(false);
    setViewerLoading({ active: true, progress: 0, message: "본문을 불러오는 중..." });
    void loadViewerDocument(document)
      .then((hydrated) => {
        if (cancelled) return;
        openDocument(hydrated, activeViewerTarget);
        void refresh();
      })
      .catch((error) => {
        if (cancelled) return;
        setViewerLoading({
          active: true,
          progress: 0,
          message: "",
          error: {
            code: "FETCH_ERR",
            message: error instanceof Error ? error.message : "본문을 불러오지 못했습니다.",
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocument?.documentId, activeViewerTarget, loadAttempt, openDocument, refresh]);

  useEffect(() => {
    if (NativeModules.VolumeKeyModule) {
      NativeModules.VolumeKeyModule.setVolumeKeyPaging(settings.volumeKeyPaging, true);
    }
    const subscription = DeviceEventEmitter.addListener("onVolumeKey", (action: "volumeUp" | "volumeDown") => {
      if (!settings.volumeKeyPaging || !activeDocument) return;
      const { current, total } = viewerPage;
      if (action === "volumeDown") {
        if (current < total) setTurnRequest({ signal: Date.now(), delta: 1 });
        else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (action === "volumeUp") {
        if (current > 1) setTurnRequest({ signal: Date.now(), delta: -1 });
        else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    });
    return () => {
      subscription.remove();
      if (NativeModules.VolumeKeyModule) {
        NativeModules.VolumeKeyModule.setVolumeKeyPaging(false, false);
      }
    };
  }, [settings.volumeKeyPaging, activeDocument, viewerPage]);



  async function onPageChanged(payload: { currentPage: number; totalPages: number; progress: number; completed?: boolean; preview?: string; boundary?: boolean; offset?: number; }) {
    if (!activeDocument || payload.boundary) {
      if (settings.pageTurnFeedback === "vibration") void Haptics.selectionAsync();
      return;
    }
    setViewerPage(prev => ({ current: payload.currentPage, total: payload.totalPages, offset: payload.offset ?? prev.offset }));
    const prior = readingsById.get(activeDocument.documentId);
    const completed = Boolean(prior?.completed || payload.completed);
    const nextReading = {
      documentId: activeDocument.documentId,
      lastPage: payload.currentPage,
      totalPages: payload.totalPages,
      progress: payload.progress,
      openedAt: Date.now(),
      completed,
      completedAt: completed ? (prior?.completedAt ?? Date.now()) : undefined,
      anchorOffset: payload.offset ?? null,
    };
    await saveReading(nextReading);
    upsertReadingState(nextReading);
    if (settings.pageTurnFeedback === "vibration") void Haptics.selectionAsync();
  }

  async function onBookmarkChanged(payload: { active: boolean; page: number; totalPages: number; progress: number; preview?: string; bookmarkId?: string; anchorOffset?: number | null; }) {
    if (!activeDocument) return;
    const nextBookmark = {
      bookmarkId: payload.bookmarkId && !payload.bookmarkId.startsWith("local-")
        ? payload.bookmarkId
        : makeBookmarkId(activeDocument.documentId, payload.page),
      documentId: activeDocument.documentId,
      page: payload.page,
      totalPages: payload.totalPages,
      progress: payload.progress,
      preview: payload.preview || activeDocument.title,
      createdAt: Date.now(),
      anchorOffset: payload.anchorOffset ?? null,
    };
    const active = await toggleBookmark(nextBookmark);
    setBookmarkState(nextBookmark, active);
  }

  async function onBookmarksSynced(payload: { bookmarks: BookmarkRecord[] }) {
    const synced = payload.bookmarks.filter((item) => item.documentId === activeDocument?.documentId);
    if (!synced.length) return;
    await syncBookmarks(synced);
    syncBookmarkState(synced);
  }

  async function onReadingSynced(payload: { reading: ReadingRecord }) {
    if (!activeDocument || payload.reading.documentId !== activeDocument.documentId) return;
    await saveReading(payload.reading);
    upsertReadingState(payload.reading);
  }

  async function changeEncoding(encoding: string) {
    if (!activeDocument) return;
    setActiveModal(null);
    viewerHasLoadedRef.current = false;
    setViewerReady(false);
    setViewerLoading({ active: true, progress: 0, message: "새로운 인코딩으로 문서를 불러오는 중..." });
    try {
      const newDoc = await loadViewerDocument(activeDocument, encoding);
      await refresh();
      setActiveDocument(newDoc);
    } catch (error) {
      setViewerLoading((prev) => ({ ...prev, active: true, error: { code: "ENCODING_FAILED", message: error instanceof Error ? error.message : "인코딩 재적용에 실패했습니다." } }));
    }
  }

  if (!activeDocument) return null;

  return (
    <ThemedScreen theme={theme} contentColor={theme.outer} contentStyle={styles.readerShell}>
      <ResponsiveFrame theme={theme} reader>
        {(metrics) => (
          <View style={styles.readerViewport}>
            <View
              style={[
                styles.readerContent,
                {
                  width: metrics.contentWidth,
                  height: metrics.contentHeight,
                },
              ]}
            >
              {activeDocument.text ? (
                <CanvasReader
                  key={activeDocument.documentId}
                  document={activeDocument}
                  settings={settings}
                  initialPage={initialPage}
                  reading={activeReading}
                  bookmarks={bookmarks}
                  targetBookmarkId={activeViewerTarget?.type === "bookmark" ? activeViewerTarget.bookmarkId : null}
                  onReady={(currentPage, totalPages, offset) => {
                    viewerHasLoadedRef.current = true;
                    setViewerPage({ current: currentPage, total: totalPages, offset: offset || 0 });
                    setViewerReady(true);
                    setViewerLoading((previous) => ({
                      ...previous,
                      active: false,
                      progress: 1,
                      message: "준비 완료",
                      error: undefined,
                    }));
                  }}
                  onPageChanged={onPageChanged}
                  onBookmarkChanged={onBookmarkChanged}
                  onReadingSynced={onReadingSynced}
                  onBookmarksSynced={onBookmarksSynced}
                  onMenuRequested={() => setActiveModal("menu")}
                  onBackRequested={closeTopViewerLayer}
                  onLoadingProgress={(payload) => setViewerLoading((previous) => ({
                    ...previous,
                    active: !viewerHasLoadedRef.current,
                    progress: payload.progress,
                    message: payload.message ?? `전체 페이지를 계산하는 중... ${Math.round(payload.progress * 100)}%`,
                    error: undefined,
                  }))}
                  onError={(payload) => {
                    setViewerReady(false);
                    setViewerLoading((prev) => ({ ...prev, active: true, error: payload }));
                  }}
                  bookmarkSignal={bookmarkSignal}
                  pageRequest={pageRequest}
                  turnRequest={turnRequest}
                  offsetRequest={offsetRequest}
                />
              ) : null}

              {viewerLoading.active ? (
                <ViewerLoadingOverlay
                  theme={theme}
                  progress={viewerLoading.progress}
                  message={viewerLoading.message}
                  error={viewerLoading.error}
                  onRetry={() => {
                    viewerHasLoadedRef.current = false;
                    setViewerReady(false);
                    setViewerLoading({ active: true, progress: 0, message: "다시 불러오는 중..." });
                    setLoadAttempt((attempt) => attempt + 1);
                  }}
                  onClose={() => setActiveDocument(null)}
                />
              ) : null}
            </View>
          </View>
        )}
      </ResponsiveFrame>

        {activeModal === "menu" && (
          <ViewerMenuModal
            visible
            title={activeDocument.title}
            current={viewerPage.current}
            total={viewerPage.total}
            theme={theme}
            onClose={closeTopViewerLayer}
            onBookmark={() => {
              setActiveModal(null);
              setBookmarkSignal((value) => value + 1);
            }}
            onNavigate={() => {
              setPageDraft(String(viewerPage.current));
              openViewerModal("pageNavigator");
            }}
            onSettings={() => {
              setActiveModal(null);
              onOpenSettings();
            }}
            onExit={() => {
              setActiveModal(null);
              setActiveDocument(null);
            }}
            hasToc={!!activeDocument.toc?.length}
            onToc={() => {
              openViewerModal("toc");
            }}
            onEncodingChange={() => {
              openViewerModal("encoding");
            }}
          />
        )}

        {activeModal === "encoding" && (
          <Modal visible transparent animationType="fade" onRequestClose={closeTopViewerLayer} statusBarTranslucent navigationBarTranslucent>
            <View style={styles.centerBackdrop}>
              <ResponsiveDialogSurface theme={theme} maxWidth={360} style={{ backgroundColor: theme.bg }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, marginBottom: 16 }}>인코딩 다시 선택</Text>
                <View style={{ gap: 8 }}>
                  {["utf8", "euc-kr", "cp949", "utf16-le", "utf16-be"].map((enc) => (
                    <Pressable key={enc} style={[styles.popupButton, { borderColor: theme.border, alignItems: "center" }]} onPress={() => changeEncoding(enc)}>
                      <Text style={{ color: theme.text }}>{enc.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[styles.popupButton, { borderColor: theme.border, marginTop: 16, backgroundColor: theme.outer, alignItems: "center" }]} onPress={closeTopViewerLayer}>
                  <Text style={{ color: theme.text }}>취소</Text>
                </Pressable>
              </ResponsiveDialogSurface>
            </View>
          </Modal>
        )}

        {activeModal === "toc" && (
          <TocModal
            visible
            toc={activeDocument.toc}
            theme={theme}
            onClose={closeTopViewerLayer}
            onSelect={(offset: number) => {
              setActiveModal(null);
              setOffsetRequest({ signal: Date.now(), offset });
            }}
          />
        )}

        {activeModal === "pageNavigator" && (
          <PageNavigatorModal
            visible
            current={viewerPage.current}
            total={viewerPage.total}
            value={pageDraft}
            theme={theme}
            bookmarks={bookmarks.filter((item) => item.documentId === activeDocument.documentId)}
            onChange={setPageDraft}
            onClose={closeTopViewerLayer}
            onGo={(page: number, options?: { keepOpen?: boolean }) => {
              setPageDraft(String(page));
              if (!options?.keepOpen) setActiveModal(null);
              setPageRequest({ signal: Date.now(), page });
            }}
          />
        )}

    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  readerShell: { flex: 1 },
  readerViewport: { flex: 1, alignItems: "center", justifyContent: "center" },
  readerContent: { overflow: "hidden" },
  centerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  viewerMenu: { width: "100%", borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.22, shadowRadius: 14 },
  sheetDragArea: { height: 40, alignItems: "center", justifyContent: "center" },
  sheetHandle: { width: 42, height: 5, borderRadius: 3 },
  modalTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  readerTitleWrap: { flex: 1, paddingRight: 16 },
  modalHeading: { fontSize: 18, fontWeight: "700" },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 28, lineHeight: 32, textAlign: "center" },
  readerMeta: { fontSize: 13, marginTop: 4 },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 24, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  viewerActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  viewerAction: { flexGrow: 1, flexBasis: "30%", minWidth: 96, height: 78, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 7 },
  viewerActionIcon: { fontSize: 23 },
  popupButton: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderRadius: 8 },
  viewerErrorPanel: { width: "100%", maxWidth: 360, alignItems: "center", padding: 24, borderWidth: 1, borderRadius: 12 },
  viewerLoading: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
  viewerLoadingArtwork: { flex: 2, minHeight: 0, width: "100%", alignItems: "center", justifyContent: "center" },
  viewerLoadingFooter: { flex: 1, width: "76%", maxWidth: 300, alignItems: "center", justifyContent: "flex-start", paddingTop: 8 },
  viewerLoadingTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  viewerLoadingTrack: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden" },
  viewerLoadingFill: { height: "100%", borderRadius: 2 },
  viewerLoadingText: { minHeight: 18, marginTop: 10, fontSize: 12, fontWeight: "600", textAlign: "center" },
  settingsSheet: { borderTopWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, gap: 14, paddingBottom: 32 },
  pageInputRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 },
  pageInput: { width: 100, height: 46, borderWidth: 1, borderRadius: 4, fontSize: 20, textAlign: "center", fontWeight: "700" },
  pageSliderRow: { height: 32, justifyContent: "center", marginBottom: 18 },
  pageSliderTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  pageSliderFill: { height: "100%", borderRadius: 3 },
  pageSliderThumb: { position: "absolute", width: 22, height: 22, marginLeft: -11, borderRadius: 11, borderWidth: 2 },
  quickGrid: { flexDirection: "row", gap: 8, marginBottom: 20 },
  secondaryButton: { flex: 1, height: 42, borderWidth: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  primaryButton: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  accentButtonText: { fontWeight: "700", fontSize: 16 },
  pageHint: { textAlign: "center", marginTop: 12, fontSize: 13 },
});
