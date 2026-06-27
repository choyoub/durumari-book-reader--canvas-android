import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ReaderSettings } from "../types";
import { nativeFontFamily, READER_FONTS, themeTokens } from "../lib/settings";
import { ThemedScreen } from "./ThemedScreen";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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
      {checked ? <Text style={styles.checkboxText}>✓</Text> : null}
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

export function SettingsModal({
  visible,
  settings,
  theme,
  onChange,
  onClose,
  onConfirm,
  onReset,
  onClearFolders,
}: {
  visible: boolean;
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
  const previewFont = nativeFontFamily(settings.fontFamily);
  const selectedFont = READER_FONTS.find((font) => font.value === settings.fontFamily) ?? READER_FONTS[0];
  const toggleLinkedPadding = () => {
    const paddingLinked = !settings.paddingLinked;
    patch({
      paddingLinked,
      paddingRight: paddingLinked ? settings.paddingLeft : settings.paddingRight,
    });
  };
  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <ThemedScreen theme={theme} contentColor={theme.card} contentStyle={styles.settingsScreen}>
          <View style={[styles.settingsSheet, { backgroundColor: theme.card }]}>
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
                <Text style={{
                  color: previewTheme.text,
                  fontFamily: previewFont,
                  fontSize: settings.fontSize,
                  fontWeight: settings.isBold ? "700" : "400",
                  lineHeight: settings.fontSize * settings.lineHeight,
                  letterSpacing: settings.letterSpacing,
                }}>
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
                      <Text numberOfLines={1} style={[styles.comboText, { color: theme.text, fontFamily: selectedFont.native }]}>{selectedFont.label}</Text>
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
                  <Pressable onPress={() => patch({ pageTurnTouch: !settings.pageTurnTouch })} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>👆 터치로 페이지 이동</Text>
                    <CheckboxMark checked={settings.pageTurnTouch} theme={theme} />
                  </Pressable>
                  <Pressable onPress={() => patch({ pageTurnSwipe: !settings.pageTurnSwipe })} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>↔️ 스와이프로 페이지 이동</Text>
                    <CheckboxMark checked={settings.pageTurnSwipe} theme={theme} />
                  </Pressable>
                  <Pressable onPress={() => patch({ pageTurnVolume: !settings.volumeKeyPaging, volumeKeyPaging: !settings.volumeKeyPaging })} style={[styles.checkRow, { borderColor: theme.border }]}>
                    <Text style={[styles.rowText, { color: theme.text }]}>🔊 볼륨키로 페이지 이동</Text>
                    <CheckboxMark checked={settings.volumeKeyPaging} theme={theme} />
                  </Pressable>
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
                  <SettingTitle text="🎨 테마 및 데이터" theme={theme} />
                  <SegmentField
                    label="테마"
                    values={[["paper", "📜 한지"], ["light", "☀️ 화이트"], ["dark", "🌙 다크"]]}
                    current={settings.theme}
                    theme={theme}
                    onChange={(value) => patch({ theme: value as ReaderSettings["theme"] })}
                  />
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
            <View style={[styles.footerPane, { borderColor: theme.border }]}>
              <Pressable onPress={onConfirm} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
                <Text style={styles.accentButtonText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </ThemedScreen>
      </Modal>

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
          <View style={[styles.fontPickerPanel, { borderColor: theme.border, backgroundColor: theme.card }]}>
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
                    <Text style={{ color: selected ? theme.accentText : theme.text, fontFamily: font.native }}>{font.label}</Text>
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
  previewPane: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1 },
  settingsPane: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  settingsContent: { padding: 14, gap: 12, paddingBottom: 18 },
  footerPane: { padding: 14, borderTopWidth: 1 },
  modalTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalHeading: { fontSize: 18, fontWeight: "700" },
  closeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 28, lineHeight: 32, textAlign: "center" },
  preview: { borderWidth: 1, minHeight: 96, maxHeight: 190, justifyContent: "center", overflow: "hidden" },
  settingSection: { borderWidth: 1, paddingHorizontal: 12, paddingBottom: 4 },
  settingTitle: { fontSize: 14, fontWeight: "700", paddingTop: 12, paddingBottom: 10 },
  settingRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  label: { width: 94, fontSize: 14 },
  rowText: { flex: 1, fontSize: 15 },
  comboText: { flex: 1, paddingRight: 8 },
  comboButton: { flex: 1, minHeight: 40, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  comboOption: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between" },
  fontPickerScreen: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  fontPickerPanel: { maxHeight: "72%", borderWidth: 1, borderRadius: 12, padding: 16 },
  fontPickerOptions: { paddingTop: 4 },
  stepper: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  stepperControls: { width: 148, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepButton: { width: 38, height: 38, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { width: 60, textAlign: "center", fontVariant: ["tabular-nums"] },
  checkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 26, height: 26, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkboxText: { color: "#FFF", fontSize: 19, lineHeight: 22, fontWeight: "800" },
  segmentField: { minHeight: 56, gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: "row", minHeight: 40, gap: 8 },
  segmentItem: { flex: 1, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dangerRow: { flexDirection: "row", gap: 10, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  secondaryButton: { flex: 1, height: 44, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryButton: { height: 48, alignItems: "center", justifyContent: "center" },
  accentButtonText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
