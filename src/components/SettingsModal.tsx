import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ReaderSettings, ThemeName } from "../types";
import { safeNativeFontFamily, safeNativeFontWeight } from "../lib/nativeText";
import { nativeFontFamily, READER_FONTS, themeTokens } from "../lib/settings";
import { useResponsiveFrameMetrics } from "./ResponsiveFrame";
import { ThemedScreen } from "./ThemedScreen";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const THEME_OPTIONS: { value: ThemeName; label: string; mark: string }[] = [
  { value: "light", label: "화이트", mark: "☀️" },
  { value: "dark", label: "다크", mark: "🌙" },
  { value: "paper", label: "한지", mark: "📜" },
  { value: "chalk", label: "칠판", mark: "▣" },
];

const PAGE_TURN_OPTIONS: {
  key: "pageTurnTouch" | "pageTurnSwipe" | "volumeKeyPaging";
  label: string;
  mark: string;
  sample: "tap" | "swipe" | "volume";
}[] = [
  { key: "pageTurnTouch", label: "터치", mark: "👆", sample: "tap" },
  { key: "pageTurnSwipe", label: "스와이프", mark: "↔️", sample: "swipe" },
  { key: "volumeKeyPaging", label: "볼륨키", mark: "🔊", sample: "volume" },
];

function SettingTitle({ text, theme }: { text: string; theme: typeof themeTokens.paper }) {
  return <Text style={[styles.settingTitle, { color: theme.accentText }]}>{text}</Text>;
}

function SettingSection({ children, theme }: { children: React.ReactNode; theme: typeof themeTokens.paper }) {
  return (
    <View style={[styles.settingSection, { borderColor: theme.border, backgroundColor: theme.card }]}>
      {children}
    </View>
  );
}

function CheckboxMark({ checked, theme }: { checked: boolean; theme: typeof themeTokens.paper }) {
  return (
    <View style={[styles.checkbox, { borderColor: theme.accent, backgroundColor: checked ? theme.accent : "transparent" }]}>
      {checked ? <Text style={[styles.checkboxText, { color: theme.accentForeground }]}>✓</Text> : null}
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  theme,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  theme: typeof themeTokens.paper;
  onChange: (value: number) => void;
}) {
  return (
    <View style={[styles.stepper, { borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.secondary }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={[styles.stepButton, { borderColor: theme.border }]} onPress={() => onChange(clamp(Number((value - step).toFixed(2)), min, max))}>
          <Text style={{ color: theme.text }}>−</Text>
        </Pressable>
        <Text style={[styles.stepValue, { color: theme.text }]}>{value}{unit}</Text>
        <Pressable style={[styles.stepButton, { borderColor: theme.border }]} onPress={() => onChange(clamp(Number((value + step).toFixed(2)), min, max))}>
          <Text style={{ color: theme.text }}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Segment({
  values,
  current,
  theme,
  onChange,
}: {
  values: [string, string][];
  current: string;
  theme: typeof themeTokens.paper;
  onChange: (value: string) => void;
}) {
  return (
    <View style={[styles.segment, { borderColor: theme.border }]}>
      {values.map(([value, label], index) => (
        <Pressable key={value} onPress={() => onChange(value)} style={[styles.segmentItem, { borderColor: current === value ? theme.accent : theme.border, backgroundColor: current === value ? theme.bg : "transparent" }]}>
          <Text style={{ color: current === value ? theme.accentText : theme.text }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SegmentField({
  label,
  values,
  current,
  theme,
  onChange,
}: {
  label: string;
  values: [string, string][];
  current: string;
  theme: typeof themeTokens.paper;
  onChange: (value: string) => void;
}) {
  return (
    <View style={[styles.segmentField, { borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.secondary }]}>{label}</Text>
      <Segment values={values} current={current} theme={theme} onChange={onChange} />
    </View>
  );
}

function ThemeSegmentField({
  current,
  theme,
  onChange,
}: {
  current: ThemeName;
  theme: typeof themeTokens.paper;
  onChange: (value: ThemeName) => void;
}) {
  return (
    <View style={[styles.segmentField, { borderColor: theme.border }]}>
      <View style={styles.themeSegment}>
        {THEME_OPTIONS.map((option) => {
          const optionTheme = themeTokens[option.value];
          const selected = current === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.themeSegmentItem,
                {
                  backgroundColor: optionTheme.outer,
                  borderColor: selected ? optionTheme.accent : optionTheme.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.themeSystemBar, styles.themeStatusBar, { backgroundColor: optionTheme.statusBar }]} />
              <View style={[styles.themePreviewPage, { backgroundColor: optionTheme.bg, borderColor: optionTheme.border }]}>
                <View style={[styles.themeAccentStrip, { backgroundColor: optionTheme.accent }]} />
                <Text style={[styles.themeMark, { color: optionTheme.accentText }]}>{option.mark}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.themeLabel, { color: optionTheme.text }]}>
                  {option.label}
                </Text>
                <View style={styles.themeSampleLines}>
                  <View style={[styles.themeSampleLine, { backgroundColor: optionTheme.text, width: "72%" }]} />
                  <View style={[styles.themeSampleLine, { backgroundColor: optionTheme.secondary, width: "52%" }]} />
                </View>
              </View>
              <View style={[styles.themeSystemBar, styles.themeNavigationBar, { backgroundColor: optionTheme.navigationBar }]} />
              <View
                style={[
                  styles.themeSelectedDot,
                  {
                    borderColor: optionTheme.accent,
                    backgroundColor: selected ? optionTheme.accent : "transparent",
                  },
                ]}
              >
                {selected ? <Text style={[styles.themeSelectedCheck, { color: optionTheme.accentForeground }]}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PageTurnMethodField({
  settings,
  theme,
  onToggle,
}: {
  settings: ReaderSettings;
  theme: typeof themeTokens.paper;
  onToggle: (key: (typeof PAGE_TURN_OPTIONS)[number]["key"]) => void;
}) {
  return (
    <View style={[styles.segmentField, { borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.secondary }]}>조작 방식</Text>
      <View style={styles.pageTurnCards}>
        {PAGE_TURN_OPTIONS.map((option) => {
          const selected = Boolean(settings[option.key]);
          return (
            <Pressable
              key={option.key}
              onPress={() => onToggle(option.key)}
              style={[
                styles.pageTurnCard,
                {
                  backgroundColor: selected ? theme.bg : "transparent",
                  borderColor: selected ? theme.accent : theme.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <View style={styles.pageTurnTitleRow}>
                <Text style={[styles.pageTurnMark, { color: selected ? theme.accentText : theme.secondary }]}>{option.mark}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.pageTurnLabel, { color: selected ? theme.accentText : theme.text }]}>
                  {option.label}
                </Text>
              </View>
              <View
                style={[
                  styles.pageTurnCheck,
                  {
                    borderColor: selected ? theme.accent : theme.border,
                    backgroundColor: selected ? theme.accent : "transparent",
                  },
                ]}
              >
                {selected ? <Text style={[styles.pageTurnCheckText, { color: theme.accentForeground }]}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsModal({
  visible,
  inline = false,
  settings,
  theme,
  onChange,
  onClose,
  onConfirm,
  onReset,
  onClearFolders,
}: {
  visible: boolean;
  inline?: boolean;
  settings: ReaderSettings;
  theme: typeof themeTokens.paper;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onClearFolders: () => void;
}) {
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  useEffect(() => {
    if (!visible) setFontPickerOpen(false);
  }, [visible]);

  const patch = (next: Partial<ReaderSettings>) => onChange({ ...settings, ...next });
  const previewTheme = themeTokens[settings.theme];
  const previewFont = safeNativeFontFamily(nativeFontFamily(settings.fontFamily));
  const selectedFont = READER_FONTS.find((font) => font.value === settings.fontFamily) ?? READER_FONTS[0];
  const toggleLinkedPadding = () => {
    const paddingLinked = !settings.paddingLinked;
    patch({
      paddingLinked,
      paddingRight: paddingLinked ? settings.paddingLeft : settings.paddingRight,
    });
  };
  const metrics = useResponsiveFrameMetrics({ maxFrameWidth: 780 });
  const fontPickerWidth = Math.min(Math.max(1, metrics.windowWidth - metrics.dialogMargin * 2), 420);
  const settingsContent = (
    <View style={[styles.settingsSheet, { backgroundColor: theme.card }]}>
      <View style={styles.settingsBody}>
        <View style={[styles.previewPane, { borderColor: theme.border }]}>
              <View style={styles.modalTitle}>
                <Text style={[styles.modalHeading, { color: theme.text }]}>설정</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="설정 닫기"
                >
                  <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
                </Pressable>
              </View>
              <View style={[
                styles.preview,
                {
                  backgroundColor: previewTheme.bg,
                  borderColor: previewTheme.border,
                  paddingTop: settings.paddingTop,
                  paddingBottom: settings.paddingBottom,
                  paddingLeft: settings.paddingLeft,
                  paddingRight: settings.paddingRight,
                },
              ]}>
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{
                    color: previewTheme.text,
                    fontFamily: previewFont,
                    fontSize: settings.fontSize,
                    fontWeight: settings.isBold ? safeNativeFontWeight("700") : safeNativeFontWeight("400"),
                    includeFontPadding: true,
                    lineHeight: settings.fontSize * settings.lineHeight,
                    letterSpacing: settings.letterSpacing,
                  }}
                >
                  소년은 개울가에서 소녀를 보자 곧 윤 초시네 증손녀딸이라는 걸 알 수 있었다.
                </Text>
              </View>
            </View>
        <View style={[styles.settingsPane, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
                <SettingSection theme={theme}>
                  <SettingTitle text="📖 읽기 설정" theme={theme} />
                  <View style={[styles.settingRow, { borderColor: theme.border }]}>
                    <Text style={[styles.label, { color: theme.secondary }]}>🖋️ 서체</Text>
                    <Pressable
                      onPress={() => setFontPickerOpen((open) => !open)}
                      style={[styles.comboButton, { borderColor: theme.border, backgroundColor: theme.bg }]}
                      accessibilityRole="button"
                      accessibilityLabel="서체 선택"
                    >
                      <Text numberOfLines={1} style={[styles.comboText, { color: theme.text, fontFamily: safeNativeFontFamily(selectedFont.native) }]}>{selectedFont.label}</Text>
                      <Text style={{ color: theme.secondary }}>{fontPickerOpen ? "▴" : "▾"}</Text>
                    </Pressable>
                  </View>
                  <Stepper label="글자 크기" value={settings.fontSize} min={10} max={36} unit="pt" theme={theme} onChange={(fontSize) => patch({ fontSize })} />
                  <Stepper label="줄 간격" value={settings.lineHeight} min={1} max={2.5} step={0.1} theme={theme} onChange={(lineHeight) => patch({ lineHeight })} />
                  <Stepper label="자간" value={settings.letterSpacing} min={-2} max={5} unit="px" theme={theme} onChange={(letterSpacing) => patch({ letterSpacing })} />
                  <Pressable onPress={() => patch({ isBold: !settings.isBold })} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>🅱️ 굵게</Text>
                    <CheckboxMark checked={settings.isBold} theme={theme} />
                  </Pressable>
                </SettingSection>

                <SettingSection theme={theme}>
                  <SettingTitle text="📐 여백 설정" theme={theme} />
                  <Pressable onPress={toggleLinkedPadding} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>↔️ 좌우 여백 동일하게 조절</Text>
                    <CheckboxMark checked={settings.paddingLinked} theme={theme} />
                  </Pressable>
                  <Stepper label="위" value={settings.paddingTop} min={0} max={120} step={5} unit="px" theme={theme} onChange={(paddingTop) => patch({ paddingTop })} />
                  <Stepper label="아래" value={settings.paddingBottom} min={0} max={120} step={5} unit="px" theme={theme} onChange={(paddingBottom) => patch({ paddingBottom })} />
                  <Stepper label="왼쪽" value={settings.paddingLeft} min={0} max={150} step={5} unit="px" theme={theme} onChange={(value) => patch({ paddingLeft: value, paddingRight: settings.paddingLinked ? value : settings.paddingRight })} />
                  <Stepper label="오른쪽" value={settings.paddingRight} min={0} max={150} step={5} unit="px" theme={theme} onChange={(value) => patch({ paddingRight: value, paddingLeft: settings.paddingLinked ? value : settings.paddingLeft })} />
                </SettingSection>

                <SettingSection theme={theme}>
                  <SettingTitle text="👆 페이지 이동 및 피드백" theme={theme} />
                  <PageTurnMethodField
                    settings={settings}
                    theme={theme}
                    onToggle={(key) => {
                      if (key === "volumeKeyPaging") {
                        patch({ pageTurnVolume: !settings.volumeKeyPaging, volumeKeyPaging: !settings.volumeKeyPaging });
                        return;
                      }
                      patch({ [key]: !settings[key] });
                    }}
                  />
                  <SegmentField
                    label="피드백"
                    values={[["none", "🔕 없음"], ["vibration", "📳 진동"], ["sound", "🔊 소리"]]}
                    current={settings.pageTurnFeedback}
                    theme={theme}
                    onChange={(pageTurnFeedback) => patch({ pageTurnFeedback: pageTurnFeedback as ReaderSettings["pageTurnFeedback"] })}
                  />
                  <SegmentField
                    label="넘김 방식"
                    values={[["none", "⏹ 없음"], ["curl", "📖 책장"], ["slide", "↔️ 슬라이드"]]}
                    current={settings.pageTurnStyle}
                    theme={theme}
                    onChange={(pageTurnStyle) => patch({ pageTurnStyle: pageTurnStyle as ReaderSettings["pageTurnStyle"] })}
                  />
                </SettingSection>

                <SettingSection theme={theme}>
                  <SettingTitle text="🎨 테마 및 필터" theme={theme} />
                  <ThemeSegmentField current={settings.theme} theme={theme} onChange={(value) => patch({ theme: value })} />
                  <Pressable onPress={() => patch({ hideCompleted: !settings.hideCompleted })} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>✅ 완독한 책 목록에서 숨김</Text>
                    <CheckboxMark checked={settings.hideCompleted} theme={theme} />
                  </Pressable>
                  <View style={[styles.dangerRow, { borderColor: theme.border }]}>
                    <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={onReset}>
                      <Text style={{ color: theme.text }}>♻️ 설정 초기화</Text>
                    </Pressable>
                    <Pressable style={[styles.secondaryButton, { borderColor: theme.danger }]} onPress={onClearFolders}>
                      <Text style={{ color: theme.danger }}>🗑️ 폴더 전체 해제</Text>
                    </Pressable>
                  </View>
                </SettingSection>
              </ScrollView>
        </View>
      </View>
      <View style={[styles.footerPane, { borderColor: theme.border }]}>
        <Pressable onPress={onConfirm} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <Text style={[styles.accentButtonText, { color: theme.accentForeground }]}>확인</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      {inline ? (
        settingsContent
      ) : (
        <Modal
          visible={visible}
          animationType="slide"
          onRequestClose={onClose}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <ThemedScreen theme={theme} contentColor={theme.card} contentStyle={styles.settingsScreen}>
            {settingsContent}
          </ThemedScreen>
        </Modal>
      )}

      <Modal
        visible={visible && fontPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFontPickerOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <ThemedScreen theme={theme} contentColor="rgba(0,0,0,0.45)" contentStyle={styles.fontPickerScreen}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFontPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="서체 목록 닫기"
          />
          <View style={[styles.fontPickerPanel, { width: fontPickerWidth, borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={styles.modalTitle}>
              <Text style={[styles.modalHeading, { color: theme.text }]}>서체 선택</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setFontPickerOpen(false)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={[styles.closeButtonText, { color: theme.secondary }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fontPickerOptions}>
              {READER_FONTS.map((font) => {
                const selected = settings.fontFamily === font.value;
                return (
                  <Pressable
                    key={font.value}
                    onPress={() => {
                      patch({ fontFamily: font.value });
                      setFontPickerOpen(false);
                    }}
                    style={[
                      styles.comboOption,
                      {
                        borderColor: theme.border,
                        backgroundColor: selected ? theme.bg : "transparent",
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={{ color: selected ? theme.accentText : theme.text, fontFamily: safeNativeFontFamily(font.native) }}>{font.label}</Text>
                    <Text style={{ color: selected ? theme.accentText : theme.secondary }}>{selected ? "●" : "○"}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ThemedScreen>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  settingsScreen: { flex: 1 },
  settingsSheet: { flex: 1 },
  settingsBody: { flex: 1, minHeight: 0 },
  previewPane: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1 },
  settingsPane: { flex: 1, minHeight: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsContent: { padding: 16, gap: 14, paddingBottom: 20 },
  footerPane: { padding: 16, borderTopWidth: 1 },
  modalTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalHeading: { fontSize: 18, fontWeight: "700" },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 28, lineHeight: 32, textAlign: "center" },
  preview: { borderWidth: 1, borderRadius: 16, minHeight: 108, maxHeight: 190, justifyContent: "center", overflow: "hidden" },
  settingSection: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingBottom: 6, overflow: "hidden" },
  settingTitle: { fontSize: 15, fontWeight: "800", paddingTop: 14, paddingBottom: 12 },
  settingRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  label: { flexShrink: 0, minWidth: 88, maxWidth: 132, fontSize: 14 },
  rowText: { flex: 1, minWidth: 0, fontSize: 15 },
  comboText: { flex: 1, minWidth: 0, paddingRight: 8 },
  comboButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  comboOption: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fontPickerScreen: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  fontPickerPanel: { maxHeight: "72%", borderWidth: 1, borderRadius: 20, padding: 16 },
  fontPickerOptions: { paddingTop: 4 },
  stepper: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  stepperControls: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 84, flexShrink: 0, textAlign: "center", fontVariant: ["tabular-nums"] },
  checkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkboxText: { fontSize: 19, lineHeight: 22, fontWeight: "800" },
  segmentField: { minHeight: 56, gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: "row", flexWrap: "wrap", minHeight: 40, gap: 8 },
  segmentItem: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  themeSegment: { flexDirection: "row", gap: 8 },
  themeSegmentItem: { flex: 1, height: 98, borderRadius: 12, alignItems: "stretch", justifyContent: "space-between", paddingHorizontal: 5, paddingVertical: 5, overflow: "hidden" },
  themeSystemBar: { height: 6 },
  themeStatusBar: { marginBottom: 4 },
  themeNavigationBar: { marginTop: 4 },
  themePreviewPage: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, paddingHorizontal: 3, paddingTop: 8, paddingBottom: 5, overflow: "hidden" },
  themeAccentStrip: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  themeMark: { fontSize: 16, lineHeight: 19, marginBottom: 2 },
  themeLabel: { maxWidth: "100%", fontSize: 11, lineHeight: 14, fontWeight: "700", textAlign: "center" },
  themeSampleLines: { width: "100%", alignItems: "center", gap: 3, marginTop: 5 },
  themeSampleLine: { height: 2, opacity: 0.65 },
  themeSelectedDot: { position: "absolute", right: 5, bottom: 5, width: 20, height: 20, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  themeSelectedCheck: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  pageTurnCards: { flexDirection: "row", gap: 8 },
  pageTurnCard: { flex: 1, height: 78, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 9, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  pageTurnTitleRow: { maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  pageTurnMark: { fontSize: 18, lineHeight: 21, textAlign: "center" },
  pageTurnCheck: { width: 24, height: 24, borderWidth: 2, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  pageTurnCheckText: { fontSize: 14, lineHeight: 17, fontWeight: "900" },
  pageTurnLabel: { flexShrink: 1, maxWidth: "100%", fontSize: 12, lineHeight: 15, fontWeight: "700", textAlign: "center" },
  dangerRow: { flexDirection: "row", gap: 10, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  secondaryButton: { flex: 1, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryButton: { height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  accentButtonText: { fontWeight: "700", fontSize: 16 },
});
