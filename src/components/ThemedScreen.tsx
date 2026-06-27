import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { themeTokens } from "../lib/settings";

type Theme = typeof themeTokens.paper;

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
