import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { themeTokens } from "../lib/settings";

export function EmptyState({
  title,
  body,
  action,
  onAction,
  theme,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  theme: typeof themeTokens.paper;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.secondary }]}>{body}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <Text style={[styles.accentButtonText, { color: theme.accentForeground }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 12 },
  primaryButton: { height: 48, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  accentButtonText: { fontWeight: "700", fontSize: 16 },
});
