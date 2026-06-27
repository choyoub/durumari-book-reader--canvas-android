import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HUNMINJEONGEUM =
  "나랏말싸미 듕귁에 달아 문자와로 서르 사맛디 아니할쎄 이런 젼차로 어린 백셩이 니르고져 홀 배 이셔도 마참내 제 뜨들 시러 펴디 못할 노미 하니라 내 이랄 위하야 어엿비 너겨 새로 스믈여듧 자랄 맹가노니 사람마다 해어 수비 니겨 날로 쓰메 편안케 하고져 할 따라미니라";

const SCROLL_START_DELAY_MS = 180;
const SCROLL_UNROLL_DURATION_MS = 1200;
const SEAL_DELAY_MS = 100;
const SEAL_DURATION_MS = 300;

export const SCROLL_ANIMATION_DURATION_MS =
  SCROLL_START_DELAY_MS + SCROLL_UNROLL_DURATION_MS + SEAL_DELAY_MS + SEAL_DURATION_MS;

function splitVerticalColumns(text: string, charactersPerColumn: number) {
  const characters = Array.from(text.replace(/\s+/g, ""));
  const columns: string[][] = [];
  for (let index = 0; index < characters.length; index += charactersPerColumn) {
    columns.push(characters.slice(index, index + charactersPerColumn));
  }
  return { characters, columns };
}

function ScrollRod({ width, axis = false }: { width: number; axis?: boolean }) {
  const capSize = axis ? 18 : 15;
  return (
    <View style={[styles.rodWrap, { width: width + 44, height: axis ? 34 : 30 }]}>
      <LinearGradient
        colors={["#d0a35f", "#65401d", "#bd8640"]}
        style={[styles.rodHandle, styles.rodHandleLeft, { width: 28 }]}
      />
      <LinearGradient
        colors={["#a7783d", "#3a200e", "#805124", "#2b1709", "#b08045"]}
        locations={[0, 0.2, 0.48, 0.8, 1]}
        style={[styles.rodBody, { width, height: axis ? 24 : 21 }]}
      />
      <LinearGradient
        colors={["#d0a35f", "#65401d", "#bd8640"]}
        style={[styles.rodHandle, styles.rodHandleRight, { width: 28 }]}
      />
      <LinearGradient
        colors={["#f1d39a", "#9a642d", "#3b210f"]}
        style={[styles.rodCap, { left: 0, width: capSize, height: capSize, borderRadius: capSize / 2 }]}
      />
      <LinearGradient
        colors={["#f1d39a", "#9a642d", "#3b210f"]}
        style={[styles.rodCap, { right: 0, width: capSize, height: capSize, borderRadius: capSize / 2 }]}
      />
    </View>
  );
}

function Tassel({ side }: { side: "left" | "right" }) {
  return (
    <View style={[styles.tassel, side === "left" ? styles.tasselLeft : styles.tasselRight]}>
      <LinearGradient colors={["#d9b867", "#6d3b24"]} style={styles.tasselCord} />
      <View style={styles.tasselKnot} />
      <View style={styles.tasselThreads}>
        {[-7, -4, -1, 2, 5].map((offset) => (
          <LinearGradient
            key={offset}
            colors={["#d9b867", offset % 2 ? "#8a3029" : "#5f2630"]}
            style={[styles.tasselThread, { left: 9 + offset, transform: [{ rotate: `${offset * 1.5}deg` }] }]}
          />
        ))}
      </View>
    </View>
  );
}

function Yuso({ width }: { width: number }) {
  return (
    <View testID="scroll-yuso-decoration" pointerEvents="none" style={[styles.yuso, { width: width + 26 }]}>
      <View style={styles.yusoRing} />
      <LinearGradient colors={["#d9b867", "#6d3b24"]} style={[styles.yusoDiagonal, styles.yusoDiagonalLeft]} />
      <LinearGradient colors={["#d9b867", "#6d3b24"]} style={[styles.yusoDiagonal, styles.yusoDiagonalRight]} />
      <Tassel side="left" />
      <Tassel side="right" />
    </View>
  );
}

function SilkBand({ width, lower = false }: { width: number; lower?: boolean }) {
  return (
    <LinearGradient
      colors={lower ? ["#6e3e35", "#a97950", "#5a302e"] : ["#263f4b", "#55717a", "#253943"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.silkBand, { width }]}
    >
      <View style={styles.silkLine} />
      <View style={styles.silkMotifs}>
        {Array.from({ length: 7 }, (_, index) => (
          <View key={index} style={[styles.silkDiamond, { opacity: index % 2 ? 0.42 : 0.7 }]} />
        ))}
      </View>
      <View style={[styles.silkLine, { bottom: 3, top: undefined }]} />
    </LinearGradient>
  );
}

export function ScrollArtwork({
  compact = false,
  onAnimationComplete,
}: {
  compact?: boolean;
  onAnimationComplete?: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const paperWidth = compact
    ? Math.min(182, Math.max(154, Math.min(screenWidth * 0.44, screenHeight * 0.26)))
    : Math.min(222, Math.max(176, Math.min(screenWidth * 0.56, screenHeight * 0.3)));
  const paperHeight = compact
    ? Math.min(226, Math.max(184, screenHeight * 0.26))
    : Math.min(292, Math.max(218, screenHeight * 0.33));
  const rodWidth = paperWidth + 28;
  const rodTop = compact ? 46 : 52;
  const paperTop = rodTop + 20;
  const bottomRodTop = rodTop + 14;
  const stageHeight = bottomRodTop + paperHeight + 34;
  const characterHeight = compact ? 11 : 14;
  const columnWidth = compact ? 13 : 18;
  const charactersPerColumn = Math.max(compact ? 8 : 10, Math.floor((paperHeight - 92) / characterHeight));
  const maxColumns = Math.max(1, Math.floor((paperWidth - 30) / columnWidth));
  const calligraphyText = Array.from(HUNMINJEONGEUM.replace(/\s+/g, ""))
    .slice(0, charactersPerColumn * maxColumns)
    .join("");
  const calligraphy = useMemo(
    () => splitVerticalColumns(calligraphyText, charactersPerColumn),
    [calligraphyText, charactersPerColumn],
  );

  const paperHeightAnimation = useRef(new Animated.Value(0)).current;
  const sealAnimation = useRef(new Animated.Value(0)).current;
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    paperHeightAnimation.setValue(0);
    sealAnimation.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(SCROLL_START_DELAY_MS),
      Animated.timing(paperHeightAnimation, {
        toValue: paperHeight,
        duration: SCROLL_UNROLL_DURATION_MS,
        useNativeDriver: false,
      }),
      Animated.delay(SEAL_DELAY_MS),
      Animated.timing(sealAnimation, {
        toValue: 1,
        duration: SEAL_DURATION_MS,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onAnimationCompleteRef.current?.();
    });
    return () => animation.stop();
  }, [paperHeight, paperHeightAnimation, sealAnimation]);

  return (
    <View style={[styles.scrollStage, { width: rodWidth + 54, height: stageHeight }]}>
      <View testID="scroll-yuso" style={[styles.decorationLayer, { top: rodTop }]}>
        <Yuso width={rodWidth} />
      </View>

      <View testID="scroll-top-rod" style={[styles.topRod, { top: rodTop }]}>
        <ScrollRod width={rodWidth} />
      </View>

      <Animated.View
        testID="scroll-paper"
        style={[
          styles.paper,
          {
            top: paperTop,
            width: paperWidth,
            height: paperHeightAnimation,
          },
        ]}
      >
        <LinearGradient
          colors={["#c9ad70", "#ead9af", "#f4e8c5", "#ddc38a"]}
          locations={[0, 0.12, 0.78, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.paperInnerBorder} />
        <View style={styles.paperFiberA} />
        <View style={styles.paperFiberB} />

        <View style={styles.topSilk}><SilkBand width={paperWidth - 2} /></View>
        <View style={styles.bottomSilk}><SilkBand width={paperWidth - 2} lower /></View>

        <View style={[styles.calligraphyArea, { top: 46, height: paperHeight - 92 }]}>
          <View style={styles.calligraphyColumns}>
            {calligraphy.columns.map((column, columnIndex) => (
              <View key={columnIndex} style={[styles.calligraphyColumn, compact && styles.calligraphyColumnCompact]}>
                {column.map((character, characterIndex) => (
                  <Text
                    key={`${columnIndex}-${characterIndex}`}
                    style={[styles.calligraphyCharacter, compact && styles.calligraphyCharacterCompact]}
                  >
                    {character}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        <Animated.View
          style={[
            styles.seal,
            compact && styles.sealCompact,
            {
              opacity: sealAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 0.82] }),
              transform: [
                { rotate: "-5deg" },
                { scale: sealAnimation.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.sealText, compact && styles.sealTextCompact]}>훈{"\n"}민</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        testID="scroll-bottom-rod"
        style={[
          styles.bottomRod,
          {
            top: bottomRodTop,
            transform: [{ translateY: paperHeightAnimation }],
          },
        ]}
      >
        <ScrollRod width={rodWidth} axis />
      </Animated.View>
    </View>
  );
}

export function IntroScroll({
  progress,
  statusText,
  onAnimationComplete,
}: {
  progress: number;
  statusText: string;
  onAnimationComplete?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#173047", "#0d1b2a", "#07111c"]}
      locations={[0, 0.58, 1]}
      style={styles.screen}
    >
      <View pointerEvents="none" style={styles.backgroundTexture} />

      <View
        style={[
          styles.introLayout,
          {
            paddingTop: Math.max(16, insets.top + 8),
            paddingBottom: Math.max(22, insets.bottom + 14),
          },
        ]}
      >
        <View style={styles.artworkRegion}>
          <ScrollArtwork onAnimationComplete={onAnimationComplete} />
        </View>

        <View style={styles.introFooter}>
          <View style={styles.brand}>
            <Text style={styles.title}>두루마리</Text>
            <Text style={styles.subtitle}>나만의 디지털 두루마리</Text>
          </View>

          <View style={styles.loading}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.status}>{statusText}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  backgroundTexture: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.1, borderWidth: 12, borderColor: "rgba(255,255,255,0.025)", transform: [{ rotate: "1deg" }] },
  introLayout: { flex: 1, width: "100%", alignItems: "center" },
  artworkRegion: { flex: 1, minHeight: 0, width: "100%", alignItems: "center", justifyContent: "center" },
  introFooter: { width: "100%", alignItems: "center", paddingHorizontal: 24 },
  scrollStage: { alignItems: "center", position: "relative" },
  scrollShadow: { position: "absolute", height: 22, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.34)", transform: [{ scaleX: 1.15 }] },
  topRod: { position: "absolute", left: 0, right: 0, zIndex: 8, alignItems: "center" },
  bottomRod: { position: "absolute", left: 0, right: 0, zIndex: 9, alignItems: "center" },
  rodWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", zIndex: 8 },
  rodBody: { borderRadius: 8, borderWidth: 1, borderColor: "#241307", shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.38, shadowRadius: 6, elevation: 7 },
  rodHandle: { height: 11, borderWidth: 1, borderColor: "#3b220f", zIndex: -1 },
  rodHandleLeft: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10, marginRight: -3 },
  rodHandleRight: { borderTopRightRadius: 10, borderBottomRightRadius: 10, marginLeft: -3 },
  rodCap: { position: "absolute", top: 8, borderWidth: 1, borderColor: "#432712" },
  paper: { position: "absolute", overflow: "hidden", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(90,57,23,0.34)", zIndex: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 4 },
  paperInnerBorder: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, margin: 5, borderWidth: 1, borderColor: "rgba(111,76,31,0.15)" },
  paperFiberA: { position: "absolute", top: 0, bottom: 0, left: "18%", width: 1, backgroundColor: "rgba(88,56,21,0.08)" },
  paperFiberB: { position: "absolute", top: 0, bottom: 0, right: "24%", width: 1, backgroundColor: "rgba(88,56,21,0.06)" },
  topSilk: { position: "absolute", top: 1, left: 0 },
  bottomSilk: { position: "absolute", bottom: 1, left: 0 },
  silkBand: { height: 38, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(220,190,126,0.58)", overflow: "hidden", justifyContent: "center" },
  silkLine: { position: "absolute", left: 8, right: 8, top: 3, height: 1, backgroundColor: "rgba(238,207,142,0.55)" },
  silkMotifs: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 10 },
  silkDiamond: { width: 10, height: 10, borderWidth: 1, borderColor: "#e0bd72", backgroundColor: "rgba(225,188,111,0.2)", transform: [{ rotate: "45deg" }] },
  calligraphyArea: { position: "absolute", left: 14, right: 14, alignItems: "center", justifyContent: "center" },
  calligraphyColumns: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "center" },
  calligraphyColumn: { width: 18, alignItems: "center" },
  calligraphyColumnCompact: { width: 13 },
  calligraphyCharacter: { height: 14, opacity: 0.92, color: "#28180e", fontFamily: "MaruBuri", fontSize: 11.5, fontWeight: "700", lineHeight: 14, textAlign: "center", textShadowColor: "rgba(38,18,6,0.32)", textShadowOffset: { width: 0.3, height: 0.4 }, textShadowRadius: 0.4 },
  calligraphyCharacterCompact: { height: 11, fontSize: 8.8, lineHeight: 11 },
  seal: { position: "absolute", left: 16, bottom: 50, width: 32, height: 32, borderWidth: 2, borderColor: "#8b261d", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(139,38,29,0.045)" },
  sealCompact: { left: 10, bottom: 46, width: 24, height: 24 },
  sealText: { color: "#8b261d", fontFamily: "MaruBuri", fontSize: 10, fontWeight: "900", lineHeight: 12, textAlign: "center" },
  sealTextCompact: { fontSize: 8, lineHeight: 9 },
  decorationLayer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, alignItems: "center" },
  yuso: { position: "absolute", top: -67, height: 83, alignItems: "center" },
  yusoRing: { position: "absolute", top: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#c39a52", backgroundColor: "#253947" },
  yusoDiagonal: { position: "absolute", top: 22, width: 112, height: 3, borderRadius: 2 },
  yusoDiagonalLeft: { left: 35, transform: [{ rotate: "-15deg" }] },
  yusoDiagonalRight: { right: 35, transform: [{ rotate: "15deg" }] },
  tassel: { position: "absolute", top: 27, width: 28, height: 72, alignItems: "center" },
  tasselLeft: { left: 27 },
  tasselRight: { right: 27 },
  tasselCord: { width: 3, height: 29, borderRadius: 2 },
  tasselKnot: { width: 13, height: 13, backgroundColor: "#a84732", borderWidth: 1, borderColor: "#e0b85f", transform: [{ rotate: "45deg" }], marginTop: -2 },
  tasselThreads: { width: 28, height: 30, marginTop: 1, position: "relative" },
  tasselThread: { position: "absolute", top: 0, width: 2, height: 27, borderRadius: 2 },
  brand: { alignItems: "center", marginBottom: 18 },
  title: { color: "#e1c17b", fontFamily: "MaruBuri", fontSize: 25, fontWeight: "700", letterSpacing: 8, paddingLeft: 8, textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  subtitle: { color: "rgba(225,193,123,0.62)", fontFamily: "MaruBuri", fontSize: 11, marginTop: 6, letterSpacing: 1.2 },
  loading: { width: "76%", maxWidth: 300, alignItems: "center" },
  progressTrack: { width: "100%", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(225,193,123,0.2)" },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: "#d4ad5f" },
  status: { color: "rgba(255,255,255,0.58)", fontFamily: "NanumGothic", fontSize: 11, textAlign: "center", marginTop: 10, minHeight: 17 },
});
