import { Platform, type TextStyle } from "react-native";

const ANDROID_TEXTVIEW_FONT = "sans-serif";

export function safeNativeFontFamily(fontFamily: string) {
  return Platform.OS === "android" ? ANDROID_TEXTVIEW_FONT : fontFamily;
}

export function safeNativeFontWeight(fontWeight: NonNullable<TextStyle["fontWeight"]>): TextStyle["fontWeight"] {
  return Platform.OS === "android" ? undefined : fontWeight;
}
