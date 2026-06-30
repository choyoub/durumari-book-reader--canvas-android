import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";

import { AppProvider, useAppContext, TabName } from "./src/contexts/AppContext";
import { IntroScroll } from "./src/components/IntroScroll";
import { MainTabPager } from "./src/components/MainTabPager";
import { ResponsiveFrame } from "./src/components/ResponsiveFrame";
import { SettingsModal } from "./src/components/SettingsModal";
import { ThemedScreen } from "./src/components/ThemedScreen";
import { ViewerScreen } from "./src/screens/ViewerScreen";
import { defaultSettings, resolveActiveFolderId, themeTokens } from "./src/lib/settings";
import { subscribeForegroundRescan } from "./src/lib/safImport";
import { clearFolders, initStore, listFolders, loadSettings, saveSettings } from "./src/lib/store";

const MAIN_TABS: readonly TabName[] = ["library", "history", "bookmarks"];
const BACKGROUND_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// Global Error Handler to catch startup crashes
if (typeof global !== "undefined" && (global as any).ErrorUtils) {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    Alert.alert(
      "초기화 오류 (JS)",
      `오류 메시지: ${error?.message || error}\n\n스택 트레이스:\n${error?.stack || "없음"}`,
      [
        {
          text: "확인",
          onPress: () => {
            if (previousHandler) {
              previousHandler(error, isFatal);
            }
          },
        },
      ]
    );
  });
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0D1B2A", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: "#E53935", fontSize: 20, fontWeight: "700", marginBottom: 12 }}>렌더링 오류 발생</Text>
          <Text style={{ color: "#FFF", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
            {this.state.error?.message || String(this.state.error)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace" }}>
            {this.state.error?.stack || ""}
          </Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

void SystemUI.setBackgroundColorAsync("#0D1B2A");

function AppContent() {
  const {
    settings,
    setSettings,
    draftSettings,
    setDraftSettings,
    activeDocument,
    setActiveDocument,
    activeFolderId,
    refresh,
    rescanFolders,
  } = useAppContext();

  const [booting, setBooting] = useState(true);
  const [bootReady, setBootReady] = useState(false);
  const [introAnimationComplete, setIntroAnimationComplete] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("앱 초기화 중...");

  const [tab, setTab] = useState<TabName>("library");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastFullSyncAtRef = useRef(0);
  const lastFolderSyncAtRef = useRef(new Map<string, number>());
  const previousActiveDocumentRef = useRef(Boolean(activeDocument));

  const requestBackgroundSync = useCallback((folderId: string | null | undefined, force = false) => {
    if (!folderId) return;
    const now = Date.now();
    const lastFullSyncAt = lastFullSyncAtRef.current;
    const lastFolderSyncAt = lastFolderSyncAtRef.current.get(folderId) ?? 0;
    if (
      !force
      && (
        now - lastFullSyncAt < BACKGROUND_SYNC_COOLDOWN_MS
        || now - lastFolderSyncAt < BACKGROUND_SYNC_COOLDOWN_MS
      )
    ) {
      return;
    }
    lastFolderSyncAtRef.current.set(folderId, now);
    void rescanFolders({ folderIds: [folderId] });
  }, [rescanFolders]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoadingProgress(0.1);
      setLoadingText("앱 초기화 중...");
      await Promise.all([
        Font.loadAsync({
          NanumGothic: require("./assets/fonts/NanumGothic.ttf"),
          NotoSerifKR: require("./assets/fonts/NotoSerifKR.ttf"),
          NotoSansKR: require("./assets/fonts/NotoSansKR.ttf"),
          MaruBuri: require("./assets/fonts/MaruBuri.ttf"),
          DoHyeon: require("./assets/fonts/DoHyeon.ttf"),
          GowunDodum: require("./assets/fonts/GowunDodum.ttf"),
          IBMPlexSerifKR: require("./assets/fonts/IBMPlexSerifKR.ttf"),
          Pretendard: require("./assets/fonts/Pretendard.ttf"),
          SpoqaHanSansNeo: require("./assets/fonts/SpoqaHanSansNeo.ttf"),
          KoPubWorldBatang: require("./assets/fonts/KoPubWorldBatang.otf"),
          RidiBatang: require("./assets/fonts/RidiBatang.otf"),
        }),
        initStore(),
      ]);
      setLoadingProgress(0.5);
      const saved = await loadSettings();
      if (!mounted) return;
      setSettings(saved);
      setDraftSettings(saved);
      setLoadingProgress(0.55);
      setLoadingText("로컬 폴더를 확인하는 중...");
      const storedFolders = await listFolders();
      const introFolderId = resolveActiveFolderId(
        storedFolders.map((folder) => folder.folderId),
        saved.activeFolderId ?? null,
      );
      await rescanFolders({
        folderIds: introFolderId ? [introFolderId] : undefined,
        onProgress: (syncProgress) => {
        if (!mounted) return;
        setLoadingProgress(0.55 + syncProgress.progress * 0.4);
        setLoadingText(syncProgress.message);
        },
      });
      if (!mounted) return;
      if (introFolderId) lastFolderSyncAtRef.current.set(introFolderId, Date.now());
      setLoadingProgress(1);
      setLoadingText("준비 완료!");
      setBootReady(true);
    }
    void boot().catch((error) => {
      setBooting(false);
      Alert.alert("초기화 실패", error instanceof Error ? error.message : "앱을 초기화하지 못했습니다.");
    });
    return () => {
      mounted = false;
    };
  }, [rescanFolders, setSettings, setDraftSettings]);

  useEffect(() => {
    if (bootReady && introAnimationComplete) setBooting(false);
  }, [bootReady, introAnimationComplete]);

  useEffect(() => {
    if (booting) return;
    return subscribeForegroundRescan(() => {
      if (!activeDocument && tab === "library") requestBackgroundSync(activeFolderId);
    });
  }, [activeDocument, activeFolderId, booting, requestBackgroundSync, tab]);

  useEffect(() => {
    if (booting || activeDocument || tab !== "library") return;
    requestBackgroundSync(activeFolderId);
  }, [activeDocument, activeFolderId, booting, requestBackgroundSync, tab]);

  useEffect(() => {
    const wasViewing = previousActiveDocumentRef.current;
    const isViewing = Boolean(activeDocument);
    previousActiveDocumentRef.current = isViewing;
    if (!booting && wasViewing && !isViewing) requestBackgroundSync(activeFolderId);
  }, [activeDocument, activeFolderId, booting, requestBackgroundSync]);

  const theme = themeTokens[settings.theme];
  const screenTheme = settingsOpen ? themeTokens[draftSettings.theme] : theme;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(booting ? "#0D1B2A" : screenTheme.navigationBar).catch(() => {});
  }, [booting, screenTheme.navigationBar]);

  useEffect(() => {
    const handleBack = () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (activeDocument) return false;
      if (tab !== "library") {
        setTab("library");
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener("hardwareBackPress", handleBack);

    return () => {
      backSub.remove();
    };
  }, [activeDocument, settingsOpen, tab]);

  async function confirmSettings() {
    setSettings(draftSettings);
    await saveSettings(draftSettings);
    setSettingsOpen(false);
  }

  function askResetSettings() {
    Alert.alert("설정 초기화", "뷰어와 목록 설정만 기본값으로 되돌릴까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "초기화",
        onPress: () => {
          setDraftSettings(defaultSettings);
        },
      },
    ]);
  }

  function askClearFolders() {
    Alert.alert("폴더 전체 해제", "등록 폴더와 앱 내부 독서 기록을 모두 삭제합니다. 원본 파일은 삭제하지 않습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "전체 해제",
        style: "destructive",
        onPress: () => void clearFolders().then(() => {
          setActiveDocument(null);
          return refresh();
        }),
      },
    ]);
  }

  if (booting) {
    return (
      <>
        <NavigationBar.NavigationBar style="light" />
        <StatusBar style="light" />
        <IntroScroll
          progress={loadingProgress}
          statusText={loadingText}
          onAnimationComplete={() => setIntroAnimationComplete(true)}
        />
      </>
    );
  }

  if (settingsOpen) {
    return (
      <ThemedScreen theme={screenTheme} contentColor={screenTheme.outer} contentStyle={styles.app}>
        <ResponsiveFrame theme={screenTheme}>
          <SettingsModal
            visible={settingsOpen}
            inline
            settings={draftSettings}
            theme={screenTheme}
            onChange={setDraftSettings}
            onClose={() => setSettingsOpen(false)}
            onConfirm={confirmSettings}
            onReset={askResetSettings}
            onClearFolders={askClearFolders}
          />
        </ResponsiveFrame>
      </ThemedScreen>
    );
  }

  if (activeDocument) {
    return (
      <ViewerScreen
        onOpenSettings={() => {
          setDraftSettings(settings);
          setSettingsOpen(true);
        }}
      />
    );
  }

  return (
    <ThemedScreen theme={screenTheme} contentColor={screenTheme.outer} contentStyle={styles.app}>
      <ResponsiveFrame theme={screenTheme}>
        <>
          <View style={[styles.tabsWrap, { borderColor: theme.border, backgroundColor: theme.bg }]}>
            <View style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {MAIN_TABS.map((name) => (
                <Pressable
                  key={name}
                  style={[
                    styles.tab,
                    tab === name && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => setTab(name)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === name }}
                >
                  <Text style={[styles.tabText, { color: tab === name ? theme.accentForeground : theme.secondary }]}>
                    {name === "library" ? "목록" : name === "history" ? "히스토리" : "책갈피"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.smallButton, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => {
              setDraftSettings(settings);
              setSettingsOpen(true);
            }}>
              <Text style={[styles.smallButtonText, { color: theme.accentText }]}>⚙</Text>
            </Pressable>
          </View>

          <MainTabPager search={search} onSearchChange={setSearch} tab={tab} onTabChange={setTab} />
        </>
      </ResponsiveFrame>
    </ThemedScreen>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  smallButton: { width: 44, height: 44, borderWidth: 1, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  smallButtonText: { fontSize: 19, fontWeight: "800" },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  tabs: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 14, flexDirection: "row", padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabText: { fontWeight: "800", fontSize: 14 },
});
