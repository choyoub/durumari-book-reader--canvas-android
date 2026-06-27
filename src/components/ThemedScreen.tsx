import React, { useEffect, useRef } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { themeTokens } from "../lib/settings";

type Theme = typeof themeTokens.paper;
const systemBackgroundStack: { id: symbol; color: string }[] = [];

function applyTopSystemBackground() {
  const next = systemBackgroundStack[systemBackgroundStack.length - 1]?.color;
  if (next) void SystemUI.setBackgroundColorAsync(next).catch(() => {});
}

export function ThemedScreen({
  children,
  theme,
  contentColor,
  contentStyle,
}: {
  children: React.ReactNode;
  theme: Theme;
  contentColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const backgroundEntryId = useRef(Symbol("ThemedScreen"));

  useEffect(() => {
    const id = backgroundEntryId.current;
    const existing = systemBackgroundStack.find((entry) => entry.id === id);
    if (existing) {
      existing.color = theme.navigationBar;
    } else {
      systemBackgroundStack.push({ id, color: theme.navigationBar });
    }
    applyTopSystemBackground();

    return () => {
      const index = systemBackgroundStack.findIndex((entry) => entry.id === id);
      if (index >= 0) systemBackgroundStack.splice(index, 1);
      applyTopSystemBackground();
    };
  }, [theme.navigationBar]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.navigationBar }]}>
      <StatusBar style={theme.statusBarStyle} />
      <NavigationBar.NavigationBar style={theme.navigationBarStyle} />
      <View
        testID="status-bar-region"
        style={{ height: insets.top, backgroundColor: theme.statusBar }}
      />
      <View
        testID="app-region"
        style={[
          styles.content,
          { backgroundColor: contentColor ?? theme.bg },
          contentStyle,
        ]}
      >
        {children}
      </View>
      <View
        testID="navigation-bar-region"
        style={{ height: insets.bottom, backgroundColor: theme.navigationBar }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
});
