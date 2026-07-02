import { Platform, Text, TextInput, type TextStyle } from "react-native";

const ANDROID_TEXTVIEW_FONT = "sans-serif";
let nativeTextDefaultsConfigured = false;

function configureFontScaling(Component: unknown) {
  const component = Component as {
    defaultProps?: Record<string, unknown>;
  };
  component.defaultProps = {
    ...component.defaultProps,
    allowFontScaling: false,
    maxFontSizeMultiplier: 1,
  };
}

export function configureNativeTextDefaults() {
  if (nativeTextDefaultsConfigured) return;
  nativeTextDefaultsConfigured = true;

  configureFontScaling(Text);
  configureFontScaling(TextInput);
}

export function safeNativeFontFamily(fontFamily: string) {
  return Platform.OS === "android" ? ANDROID_TEXTVIEW_FONT : fontFamily;
}

export function safeNativeFontWeight(fontWeight: NonNullable<TextStyle["fontWeight"]>): TextStyle["fontWeight"] {
  return Platform.OS === "android" ? undefined : fontWeight;
}
