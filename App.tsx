import React, { useEffect, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";

import { AppProvider, useAppContext, TabName } from "./src/contexts/AppContext";
import { IntroScroll } from "./src/components/IntroScroll";
import { MainTabPager } from "./src/components/MainTabPager";
import { SettingsModal } from "./src/components/SettingsModal";
import { ThemedScreen } from "./src/components/ThemedScreen";
import { ViewerScreen } from "./src/screens/ViewerScreen";
import { defaultSettings, themeTokens } from "./src/lib/settings";
import { subscribeForegroundRescan } from "./src/lib/safImport";
import { clearFolders, initStore, loadSettings, saveSettings } from "./src/lib/store";

const MAIN_TABS: readonly TabName[] = ["library", "history", "bookmarks"];

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
      await rescanFolders((syncProgress) => {
        if (!mounted) return;
        setLoadingProgress(0.55 + syncProgress.progress * 0.4);
        setLoadingText(syncProgress.message);
      });
      if (!mounted) return;
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
      void rescanFolders();
    });
  }, [booting, rescanFolders]);

  const theme = themeTokens[settings.theme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(booting ? "#0D1B2A" : theme.navigationBar).catch(() => {});
  }, [booting, theme.navigationBar]);

  useEffect(() => {
    const handleBack = () => {
      if (activeDocument) return false;
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
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

  if (activeDocument) {
    return <ViewerScreen />;
  }

  return (
    <ThemedScreen theme={theme} contentStyle={styles.app}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={
                tab === "library"
                  ? "현재 폴더 제목 검색"
                  : tab === "history"
                  ? "히스토리 제목 검색"
                  : "책갈피 제목 검색"
              }
              placeholderTextColor={theme.secondary}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          <Pressable style={[styles.smallButton, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => {
            setDraftSettings(settings);
            setSettingsOpen(true);
          }}>
            <Text style={{ color: theme.text }}>⚙️ 설정</Text>
          </Pressable>
        </View>

        <View style={[styles.tabs, { borderColor: theme.border }]}>
          {MAIN_TABS.map((name) => (
            <Pressable key={name} style={[styles.tab, tab === name && { borderBottomColor: theme.accent }]} onPress={() => setTab(name)}>
              <Text style={[styles.tabText, { color: tab === name ? theme.accent : theme.secondary }]}>
                {name === "library" ? "📚 목록" : name === "history" ? "🕘 히스토리" : "🔖 책갈피"}
              </Text>
            </Pressable>
          ))}
        </View>

        <MainTabPager search={search} tab={tab} onTabChange={setTab} />

        {settingsOpen && (
          <SettingsModal
            visible={settingsOpen}
            settings={draftSettings}
            theme={theme}
            onChange={setDraftSettings}
            onClose={() => setSettingsOpen(false)}
            onConfirm={confirmSettings}
            onReset={askResetSettings}
            onClearFolders={askClearFolders}
          />
        )}
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
  header: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
  smallButton: { minHeight: 34, paddingHorizontal: 14, borderWidth: 1, justifyContent: "center", borderRadius: 4 },
  searchBox: { flex: 1, height: 42, borderWidth: 1, paddingHorizontal: 12, justifyContent: "center", borderRadius: 4 },
  searchInput: { fontSize: 15 },
  headerSpacer: { flex: 1 },
  tabs: { height: 46, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontWeight: "700" },
});
