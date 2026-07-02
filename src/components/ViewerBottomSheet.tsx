import React, { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { themeTokens } from "../lib/settings";
import { ResponsiveBottomSheet, ResponsiveFrameMetrics } from "./ResponsiveFrame";

type Theme = typeof themeTokens.paper;

export function ViewerBottomSheet({
  visible,
  theme,
  title,
  subtitle,
  titleContent,
  closeAccessibilityLabel = "닫기",
  dragAccessibilityLabel = "아래로 스와이프해서 닫기",
  maxWidth,
  contentStyle,
  onClose,
  children,
}: {
  visible: boolean;
  theme: Theme;
  title?: string;
  subtitle?: string;
  titleContent?: React.ReactNode;
  closeAccessibilityLabel?: string;
  dragAccessibilityLabel?: string;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  onClose: () => void;
  children: React.ReactNode | ((metrics: ResponsiveFrameMetrics) => React.ReactNode);
}) {
  const dragY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) dragY.setValue(0);
  }, [dragY, visible]);

  const resetDrag = () => {
    Animated.spring(dragY, {
      toValue: 0,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

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
        resetDrag();
      },
      onPanResponderTerminate: resetDrag,
    }),
  ).current;

  const hasHeader = Boolean(title || subtitle || titleContent);

  return (
    <ResponsiveBottomSheet
      visible={visible}
      theme={theme}
      onRequestClose={onClose}
      maxWidth={maxWidth}
      animatedStyle={{ transform: [{ translateY: dragY }] }}
    >
      {(metrics) => (
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border, maxHeight: metrics.bottomSheetMaxHeight }, contentStyle]}>
          <View
            style={styles.dragArea}
            accessibilityRole="button"
            accessibilityLabel={dragAccessibilityLabel}
            {...dragResponder.panHandlers}
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>
          {hasHeader ? (
            <View style={styles.header}>
              {titleContent ?? (
                <View style={styles.titleWrap}>
                  {title ? <Text numberOfLines={1} style={[styles.heading, { color: theme.text }]}>{title}</Text> : null}
                  {subtitle ? <Text style={[styles.subtitle, { color: theme.secondary }]}>{subtitle}</Text> : null}
                </View>
              )}
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={4} accessibilityRole="button" accessibilityLabel={closeAccessibilityLabel}>
                <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
              </Pressable>
            </View>
          ) : null}
          {typeof children === "function" ? children(metrics) : children}
        </View>
      )}
    </ResponsiveBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 28,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  dragArea: { height: 40, alignItems: "center", justifyContent: "center" },
  handle: { width: 42, height: 5, borderRadius: 3 },
  header: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  titleWrap: { flex: 1, paddingRight: 16 },
  heading: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 28, lineHeight: 32, textAlign: "center" },
});
