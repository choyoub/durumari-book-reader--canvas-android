import React from "react";
import { Animated, Modal, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { themeTokens } from "../lib/settings";

type Theme = typeof themeTokens.paper;

const MAX_BOOK_ASPECT = 2 / 3;

export interface ResponsiveFrameMetrics {
  windowWidth: number;
  windowHeight: number;
  frameWidth: number;
  frameHeight: number;
  contentWidth: number;
  contentHeight: number;
  outerPadding: number;
  dialogMargin: number;
  bottomSheetWidth: number;
  bottomSheetMaxHeight: number;
  isCompact: boolean;
  isFramed: boolean;
  isLandscape: boolean;
  isShort: boolean;
  isWide: boolean;
}

export function useResponsiveFrameMetrics({ reader = false, maxFrameWidth = 760 }: { reader?: boolean; maxFrameWidth?: number } = {}): ResponsiveFrameMetrics {
  const { width, height } = useWindowDimensions();
  const windowWidth = Math.max(1, width);
  const windowHeight = Math.max(1, height);
  const isLandscape = windowWidth > windowHeight;
  const isShort = windowHeight < 520;
  const isCompact = windowWidth < 700 || isShort;
  const isFramed = true;
  const outerPadding = 0;
  const availableWidth = Math.max(1, windowWidth - outerPadding * 2);
  const availableHeight = Math.max(1, windowHeight - outerPadding * 2);

  let frameWidth = availableWidth;
  let frameHeight = availableHeight;
  let contentWidth = frameWidth;
  let contentHeight = frameHeight;

  if (isFramed && reader) {
    const maxWidthForFullHeight = availableHeight * MAX_BOOK_ASPECT;
    frameHeight = availableHeight;
    frameWidth = Math.min(availableWidth, maxWidthForFullHeight);
    contentWidth = frameWidth;
    contentHeight = frameHeight;
  } else if (isFramed) {
    frameHeight = availableHeight;
    frameWidth = Math.min(availableWidth, availableHeight * MAX_BOOK_ASPECT);
    contentWidth = frameWidth;
    contentHeight = frameHeight;
  }

  const dialogMargin = isCompact ? 16 : 24;
  const sheetAvailableWidth = Math.max(1, windowWidth - dialogMargin * 2);
  const bottomSheetWidth = Math.min(
    sheetAvailableWidth,
    isFramed ? frameWidth : sheetAvailableWidth,
    maxFrameWidth,
  );
  const bottomSheetMaxHeight = Math.max(260, windowHeight - dialogMargin * 2);

  return {
    windowWidth,
    windowHeight,
    frameWidth,
    frameHeight,
    contentWidth,
    contentHeight,
    outerPadding,
    dialogMargin,
    bottomSheetWidth,
    bottomSheetMaxHeight,
    isCompact,
    isFramed,
    isLandscape,
    isShort,
    isWide: frameWidth >= 680,
  };
}

export function ResponsiveFrame({
  children,
  theme,
  reader = false,
  maxFrameWidth,
  surfaceStyle,
}: {
  children: React.ReactNode | ((metrics: ResponsiveFrameMetrics) => React.ReactNode);
  theme: Theme;
  reader?: boolean;
  maxFrameWidth?: number;
  surfaceStyle?: StyleProp<ViewStyle>;
}) {
  const metrics = useResponsiveFrameMetrics({ reader, maxFrameWidth });
  const content = typeof children === "function" ? children(metrics) : children;

  return (
    <View style={[styles.framedRoot, { backgroundColor: theme.outer, padding: metrics.outerPadding }]}>
      <View
        style={[
          styles.framedSurface,
          surfaceStyle,
          {
            width: metrics.frameWidth,
            height: metrics.frameHeight,
            backgroundColor: theme.bg,
            borderColor: theme.border,
          },
        ]}
      >
        {content}
      </View>
    </View>
  );
}

export function ResponsiveBottomSheet({
  visible,
  theme,
  onRequestClose,
  children,
  maxWidth = 760,
  fill = false,
  animatedStyle,
  contentStyle,
  backdropColor = "rgba(0,0,0,0.56)",
}: {
  visible: boolean;
  theme: Theme;
  onRequestClose: () => void;
  children: React.ReactNode | ((metrics: ResponsiveFrameMetrics) => React.ReactNode);
  maxWidth?: number;
  fill?: boolean;
  animatedStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
}) {
  const insets = useSafeAreaInsets();
  const metrics = useResponsiveFrameMetrics({ maxFrameWidth: maxWidth });
  const content = typeof children === "function" ? children(metrics) : children;
  const bodyMaxHeight = Math.max(240, metrics.bottomSheetMaxHeight - insets.bottom);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.bottomSheetBackdrop, { backgroundColor: backdropColor }]}>
        <Animated.View
          style={[
            styles.bottomSheetStack,
            {
              width: metrics.bottomSheetWidth,
              maxHeight: metrics.bottomSheetMaxHeight,
            },
            animatedStyle,
          ]}
        >
          <View style={[fill ? { height: bodyMaxHeight } : { maxHeight: bodyMaxHeight }, contentStyle]}>
            {content}
          </View>
          <View style={{ height: insets.bottom, backgroundColor: theme.card }} />
        </Animated.View>
        <View
          pointerEvents="none"
          style={[
            styles.bottomNavigationOverlay,
            {
              height: insets.bottom,
              backgroundColor: theme.navigationBar,
            },
          ]}
        />
      </View>
    </Modal>
  );
}

export function ResponsiveDialogSurface({
  children,
  theme,
  maxWidth = 420,
  style,
}: {
  children: React.ReactNode;
  theme: Theme;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const metrics = useResponsiveFrameMetrics({ maxFrameWidth: maxWidth });
  const width = Math.min(Math.max(1, metrics.windowWidth - metrics.dialogMargin * 2), maxWidth);

  return (
    <View
      style={[
        styles.dialogSurface,
        {
          width,
          maxHeight: metrics.bottomSheetMaxHeight,
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  compactFrame: { flex: 1, width: "100%" },
  framedRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  framedSurface: {
    flexShrink: 1,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  bottomSheetBackdrop: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bottomSheetStack: {
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  bottomNavigationOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 20 },
  dialogSurface: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
});
