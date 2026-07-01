import type { BookmarkRecord, ReaderSettings, ReadingRecord } from "../types";

export interface CanvasDocumentPayload {
  documentId: string;
  title: string;
  text: string;
  initialPage?: number;
  reading?: ReadingRecord | null;
  bookmarks: BookmarkRecord[];
  targetBookmarkId?: string | null;
  settings: ReaderSettings;
  fontUris?: Record<string, string>;
  settingsKey?: string;
}

export function createCanvasHtml(payload: CanvasDocumentPayload) {
  const encoded = JSON.stringify(payload).replace(/</g, "\\u003c");
  const fontFaces = Object.entries(payload.fontUris ?? {})
    .map(([name, uri]) => `@font-face { font-family: '${name}'; src: url(${JSON.stringify(uri)}); font-display: block; }`)
    .join("\n    ");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    ${fontFaces}
    html, body { width:100%; height:100%; margin:0; padding:0; overflow:hidden; background:#f2ead3; outline:none; }
    *:focus { outline:none !important; }
    canvas { display:block; width:100%; height:100%; touch-action:none; background:#f2ead3; outline:none; -webkit-tap-highlight-color:transparent; }
    #toast { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); max-width:80vw; padding:8px 12px; border-radius:6px; color:#fff; background:rgba(0,0,0,.68); font:13px sans-serif; opacity:0; transition:opacity .16s; pointer-events:none; }
    #dogear { position:fixed; top:0; right:0; width:48px; height:48px; pointer-events:none; display:none; filter:drop-shadow(-2px 3px 3px rgba(0,0,0,.24)); }
  </style>
</head>
<body>
  <canvas id="page"></canvas>
  <canvas id="dogear"></canvas>
  <div id="toast"></div>
  <script>
    const INITIAL = ${encoded};
    const canvas = document.getElementById("page");
    const dogear = document.getElementById("dogear");
    const toast = document.getElementById("toast");
    const ctx = canvas.getContext("2d");
    const dog = dogear.getContext("2d");
    const allowedIncoming = new Set(["initializeDocument","updateSettings","goToPage","goToOffset","turnPage","toggleBookmark","cancelLoading","disposeDocument"]);
    let documentData = INITIAL;
    let settings = INITIAL.settings;
    let settingsKey = INITIAL.settingsKey || "";
    let starts = [0, INITIAL.text.length];
    let page = Math.max(1, INITIAL.initialPage || 1);
    let targetOffset = null;
    let disposed = false;
    let lastBoundaryFeedback = 0;
    let pointer = null;
    let longPressTimer = null;
    let suppressClickUntil = 0;
    let isAnimating = false;
    let animationFrame = null;
    let paginationRunId = 0;
    let prewarmTimer = null;
    let viewportCache = { width: 1, height: 1, dpr: 1 };
    const pageSurfaces = new Map();
    const PAGE_NUMBER_FONT_SIZE = 15;
    const PAGE_NUMBER_BOTTOM_OFFSET = 24;
    const TURN_DURATION = 380;
    const BOUNDARY_DURATION = 180;
    const MAX_RENDER_DPR = 2;
    const SURFACE_RADIUS = 1;
    const PAGINATION_YIELD_MS = 12;
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    let glyphWidthCacheKey = "";
    let glyphWidthCache = new Map();

    const themes = {
      light: { bg:"#f8f4ed", text:"#1a1a2e", accent:"#2563eb", dog:"#e2dbcc", crease:"#e0d8c8" },
      dark: { bg:"#121212", text:"#e0e0e0", accent:"#8ab4f8", dog:"#090909", crease:"#2d2d2d" },
      paper: { bg:"#f2ead3", text:"#2a2a2a", accent:"#9a5a10", dog:"#cfbe90", crease:"#d5c5a0" },
      chalk: { bg:"#183b32", text:"#f1ead0", accent:"#f3c969", dog:"#0d241f", crease:"#3b665b" }
    };

    function post(type, payload, requestId) {
      const message = JSON.stringify({ version:1, type, requestId: requestId || null, payload });
      if (window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(message);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    }

    function textFontSpec() {
      return (settings.isBold ? "700 " : "400 ") + settings.fontSize + "px " + settings.fontFamily;
    }

    function resetGlyphWidthCache() {
      glyphWidthCacheKey = textFontSpec() + "|" + settings.letterSpacing;
      glyphWidthCache = new Map();
      measureContext.font = textFontSpec();
    }

    function glyphWidth(ch) {
      const cacheKey = textFontSpec() + "|" + settings.letterSpacing;
      if (glyphWidthCacheKey !== cacheKey) resetGlyphWidthCache();
      const key = ch === "\\t" ? "    " : ch;
      const cached = glyphWidthCache.get(key);
      if (cached !== undefined) return cached;
      const width = measureContext.measureText(key).width + settings.letterSpacing;
      glyphWidthCache.set(key, width);
      return width;
    }

    async function waitForRenderPrerequisites(runId) {
      try {
        const fontSpec = textFontSpec();
        if (document.fonts?.load) await document.fonts.load(fontSpec);
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {}
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      resetGlyphWidthCache();
      return !disposed && runId === paginationRunId;
    }

    async function paginateInline() {
      const runId = ++paginationRunId;
      cancelPrewarm();
      try {
        post("loadingProgress", { progress: 0, message: "전체 페이지를 계산하는 중..." });
        if (!(await waitForRenderPrerequisites(runId))) return;
        updateViewportCache();
        const width = Math.max(160, viewportWidth() - settings.paddingLeft - settings.paddingRight);
        const height = Math.max(160, contentBottomY(viewportHeight()) - settings.paddingTop - settings.paddingBottom);
        const maxLines = Math.max(1, Math.floor(height / Math.max(1, settings.fontSize * settings.lineHeight)));
        const nextStarts = [0];
        let line = 0;
        let lineWidth = 0;
        let lastYieldAt = performance.now();
        const text = documentData.text || "";
        for (let index = 0; index < text.length; index++) {
          if (disposed || runId !== paginationRunId) return;
          const now = performance.now();
          if (now - lastYieldAt > PAGINATION_YIELD_MS) {
            post("loadingProgress", { progress: Math.min(.95, index / Math.max(1, text.length)) });
            await new Promise(resolve => setTimeout(resolve, 0));
            if (disposed || runId !== paginationRunId) return;
            lastYieldAt = performance.now();
          }
          const code = text.charCodeAt(index);
          if (code === 13) continue;
          if (code === 10) {
            line++;
            lineWidth = 0;
            if (line >= maxLines && index + 1 < text.length) {
              nextStarts.push(index + 1);
              line = 0;
            }
            continue;
          }
          const widthValue = glyphWidth(text[index]);
          if (lineWidth > 0 && lineWidth + widthValue > width) {
            line++;
            lineWidth = 0;
            if (line >= maxLines) {
              nextStarts.push(index);
              line = 0;
            }
          }
          lineWidth += widthValue;
        }
        if (runId !== paginationRunId) return;
        if (nextStarts[nextStarts.length - 1] !== text.length) nextStarts.push(text.length);
        starts = nextStarts;
        const syncedReading = syncReading();
        const syncedBookmarks = syncBookmarks();
        if (documentData.targetBookmarkId) {
          const targetBookmark = syncedBookmarks.find(bookmark => bookmark.bookmarkId === documentData.targetBookmarkId);
          if (targetBookmark) page = targetBookmark.page;
          documentData.targetBookmarkId = null;
          targetOffset = null;
        } else if (targetOffset !== null) {
          page = pageForOffset(targetOffset);
          targetOffset = null;
        } else if (syncedReading) {
          page = syncedReading.lastPage;
        } else {
          page = Math.min(Math.max(1, page), totalPages());
        }
        pageSurfaces.clear();
        render();
        post("loadingProgress", { progress: 1, message: "준비 완료" });
        post("ready", { totalPages: totalPages(), currentPage: page, progress: progress(), title: documentData.title, offset: starts[page - 1] || 0, settingsKey });
      } catch (error) {
        post("error", { code: "PAGINATION_FAILED", message: error?.message || "페이지를 계산하는 중 오류가 발생했습니다." });
      }
    }

    function totalPages() {
      return Math.max(1, starts.length - 1);
    }

    function progress() {
      return totalPages() <= 1 ? 0 : (page - 1) / (totalPages() - 1);
    }

    function renderDpr() {
      return Math.max(1, Math.min(MAX_RENDER_DPR, window.devicePixelRatio || 1));
    }

    function updateViewportCache() {
      const width = Math.max(1, Math.round(canvas.getBoundingClientRect().width || document.documentElement.clientWidth || window.innerWidth));
      const height = Math.max(1, Math.round(canvas.getBoundingClientRect().height || document.documentElement.clientHeight || window.innerHeight));
      const dpr = renderDpr();
      const changed = viewportCache.width !== width || viewportCache.height !== height || viewportCache.dpr !== dpr;
      viewportCache = { width, height, dpr };
      return changed;
    }

    function viewportWidth() {
      return viewportCache.width;
    }

    function viewportHeight() {
      return viewportCache.height;
    }

    function pageNumberTopY(height) {
      return height - PAGE_NUMBER_BOTTOM_OFFSET - PAGE_NUMBER_FONT_SIZE / 2;
    }

    function contentBottomY(height) {
      return pageNumberTopY(height);
    }

    function previewText() {
      return (documentData.text || "").slice(starts[page - 1], starts[page]).replace(/\\s+/g, " ").trim().slice(0, 80);
    }

    function pagePreview(pageNum) {
      return (documentData.text || "").slice(starts[pageNum - 1], starts[pageNum]).replace(/\\s+/g, " ").trim().slice(0, 80);
    }

    function pageProgress(pageNum) {
      return totalPages() <= 1 ? 0 : (pageNum - 1) / (totalPages() - 1);
    }

    function pageForOffset(offset) {
      const textLength = (documentData.text || "").length;
      const safeOffset = Math.max(0, Math.min(textLength, Math.round(Number(offset) || 0)));
      let foundPage = starts.length;
      for (let i = 0; i < starts.length; i++) {
        if (safeOffset < starts[i]) {
          foundPage = i;
          break;
        }
      }
      return Math.min(totalPages(), Math.max(1, foundPage));
    }

    function findPreviewOffset(preview) {
      const needle = String(preview || "").replace(/\\s+/g, " ").trim();
      const text = documentData.text || "";
      if (!needle) return null;
      const direct = text.indexOf(needle);
      if (direct >= 0) return direct;
      const chars = [];
      const offsets = [];
      let previousWasSpace = false;
      for (let index = 0; index < text.length; index++) {
        const ch = text[index];
        if (/\\s/.test(ch)) {
          if (!previousWasSpace) {
            chars.push(" ");
            offsets.push(index);
            previousWasSpace = true;
          }
        } else {
          chars.push(ch);
          offsets.push(index);
          previousWasSpace = false;
        }
      }
      const normalizedIndex = chars.join("").indexOf(needle);
      return normalizedIndex >= 0 ? offsets[normalizedIndex] ?? null : null;
    }

    function resolveAnchorOffset(bookmark) {
      const textLength = (documentData.text || "").length;
      if (Number.isFinite(bookmark.anchorOffset)) {
        return Math.max(0, Math.min(textLength, Math.round(bookmark.anchorOffset)));
      }
      const previewOffset = findPreviewOffset(bookmark.preview);
      if (previewOffset !== null) return previewOffset;
      if (Number.isFinite(bookmark.progress)) {
        return Math.max(0, Math.min(textLength, Math.round(bookmark.progress * textLength)));
      }
      const fallbackPage = Math.min(totalPages(), Math.max(1, Math.round(bookmark.page || 1)));
      return starts[fallbackPage - 1] || 0;
    }

    function resolveReadingAnchorOffset(reading) {
      const textLength = (documentData.text || "").length;
      if (Number.isFinite(reading.anchorOffset)) {
        return Math.max(0, Math.min(textLength, Math.round(reading.anchorOffset)));
      }
      if (Number.isFinite(reading.progress)) {
        return Math.max(0, Math.min(textLength, Math.round(reading.progress * textLength)));
      }
      const fallbackPage = Math.min(totalPages(), Math.max(1, Math.round(reading.lastPage || 1)));
      return starts[fallbackPage - 1] || 0;
    }

    function recordChanged(previous, next, pageField) {
      return previous[pageField] !== next[pageField]
        || previous.totalPages !== next.totalPages
        || Math.abs((previous.progress || 0) - (next.progress || 0)) > 0.000001
        || previous.anchorOffset !== next.anchorOffset
        || (previous.preview !== undefined && next.preview !== undefined && previous.preview !== next.preview);
    }

    function syncReading() {
      const reading = documentData.reading;
      if (!reading) return null;
      const needsSync = reading.totalPages !== totalPages() || !Number.isFinite(reading.anchorOffset);
      if (!needsSync) return null;
      const anchorOffset = resolveReadingAnchorOffset(reading);
      const readingPage = pageForOffset(anchorOffset);
      const synced = {
        ...reading,
        lastPage: readingPage,
        totalPages: totalPages(),
        progress: pageProgress(readingPage),
        anchorOffset,
      };
      documentData.reading = synced;
      if (recordChanged(reading, synced, "lastPage")) {
        post("readingSynced", { reading: synced });
      }
      return synced;
    }

    function syncBookmarks() {
      const bookmarks = Array.isArray(documentData.bookmarks) ? documentData.bookmarks : [];
      const changed = [];
      const synced = bookmarks.map((bookmark) => {
        const isTarget = bookmark.bookmarkId === documentData.targetBookmarkId;
        const needsSync = isTarget || bookmark.totalPages !== totalPages() || !Number.isFinite(bookmark.anchorOffset);
        if (!needsSync) return bookmark;
        const anchorOffset = resolveAnchorOffset(bookmark);
        const bookmarkPage = pageForOffset(anchorOffset);
        const nextBookmark = {
          ...bookmark,
          page: bookmarkPage,
          totalPages: totalPages(),
          progress: pageProgress(bookmarkPage),
          preview: pagePreview(bookmarkPage),
          anchorOffset,
        };
        if (recordChanged(bookmark, nextBookmark, "page")) changed.push(nextBookmark);
        return nextBookmark;
      });
      documentData.bookmarks = synced;
      if (changed.length) post("bookmarksSynced", { bookmarks: changed });
      return synced;
    }

    function bookmarkForPage(pageNum) {
      const bookmarks = Array.isArray(documentData.bookmarks) ? documentData.bookmarks : [];
      return bookmarks.find(bookmark => bookmark.page === pageNum) || null;
    }

    function resize() {
      const changed = updateViewportCache();
      if (!changed && canvas.width > 0 && canvas.height > 0) return;
      const { width, height, dpr } = viewportCache;
      cancelPrewarm();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pageSurfaces.clear();
      void paginateInline();
    }

    function paginationSettingsChanged(previous, next) {
      return previous.fontFamily !== next.fontFamily
        || previous.fontSize !== next.fontSize
        || previous.isBold !== next.isBold
        || previous.lineHeight !== next.lineHeight
        || previous.letterSpacing !== next.letterSpacing
        || previous.paddingTop !== next.paddingTop
        || previous.paddingBottom !== next.paddingBottom
        || previous.paddingLeft !== next.paddingLeft
        || previous.paddingRight !== next.paddingRight;
    }

    function visualSettingsChanged(previous, next) {
      return paginationSettingsChanged(previous, next)
        || previous.theme !== next.theme;
    }

    function pageLineRanges(pageNum, width) {
      const ranges = [];
      const text = documentData.text || "";
      const pageStart = starts[pageNum - 1] || 0;
      const pageEnd = starts[pageNum] ?? text.length;
      let lineStart = pageStart;
      let lineWidth = 0;
      for (let index = pageStart; index < pageEnd; index++) {
        const code = text.charCodeAt(index);
        if (code === 13) continue;
        if (code === 10) {
          ranges.push([lineStart, index]);
          lineStart = index + 1;
          lineWidth = 0;
          continue;
        }
        const widthValue = glyphWidth(text[index]);
        if (index > lineStart && lineWidth + widthValue > width) {
          ranges.push([lineStart, index]);
          lineStart = index;
          lineWidth = 0;
        }
        lineWidth += widthValue;
      }
      if (lineStart < pageEnd) ranges.push([lineStart, pageEnd]);
      return ranges;
    }

    function drawTextRun(target, value, x, y) {
      if (!value) return;
      let cursorX = x;
      for (const ch of value) {
        if (ch === "\\r") continue;
        const drawValue = ch === "\\t" ? "    " : ch;
        target.fillText(drawValue, cursorX, y);
        cursorX += glyphWidth(ch);
      }
    }

    function hexToRgba(hex, alpha) {
      const raw = String(hex || "").replace("#", "");
      if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "rgba(0,0,0," + alpha + ")";
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }

    function drawBookmarkCornerMarker(pageNum, target, width, height, theme) {
      if (!bookmarkForPage(pageNum)) return;
      const size = 24;
      target.save();
      target.fillStyle = theme.dog;
      target.beginPath();
      target.moveTo(width - size, 0);
      target.lineTo(width, 0);
      target.lineTo(width, size);
      target.closePath();
      target.fill();
      target.strokeStyle = settings.theme === "dark" ? hexToRgba(theme.crease, 0.86) : theme.crease;
      target.lineWidth = 1.25;
      target.beginPath();
      target.moveTo(width - size, 0.5);
      target.lineTo(width - 0.5, size);
      target.stroke();
      target.strokeStyle = settings.theme === "dark" || settings.theme === "chalk"
        ? hexToRgba(theme.accent, 0.62)
        : hexToRgba(theme.accent, 0.72);
      target.lineWidth = 2;
      target.beginPath();
      target.moveTo(width - 11, 3);
      target.lineTo(width - 3, 11);
      target.stroke();
      target.restore();
    }

    function drawPage(pageNum, target, width, height, theme) {
      if (pageNum < 1 || pageNum > totalPages()) return;
      target.fillStyle = theme.bg;
      target.fillRect(0, 0, width, height);
      target.fillStyle = theme.text;
      target.font = (settings.isBold ? "700 " : "400 ") + settings.fontSize + "px " + settings.fontFamily;
      target.textBaseline = "top";
      const contentWidth = Math.max(160, width - settings.paddingLeft - settings.paddingRight);
      const text = documentData.text || "";
      const lines = pageLineRanges(pageNum, contentWidth);
      let y = settings.paddingTop;
      const maxY = contentBottomY(height) - settings.paddingBottom;
      for (const [start, end] of lines) {
        if (y + settings.fontSize > maxY) break;
        drawTextRun(target, text.slice(start, end), settings.paddingLeft, y);
        y += settings.fontSize * settings.lineHeight;
      }
      target.save();
      target.globalAlpha = settings.theme === "dark" ? 0.28 : 0.24;
      target.fillStyle = theme.text;
      target.font = "400 " + PAGE_NUMBER_FONT_SIZE + "px " + settings.fontFamily;
      target.textAlign = "center";
      target.textBaseline = "middle";
      target.fillText(pageNum + " / " + totalPages(), width / 2, height - PAGE_NUMBER_BOTTOM_OFFSET);
      target.restore();
      drawBookmarkCornerMarker(pageNum, target, width, height, theme);
    }

    function getPageSurface(pageNum) {
      if (pageSurfaces.has(pageNum)) return pageSurfaces.get(pageNum);
      const theme = themes[settings.theme] || themes.paper;
      const width = viewportWidth();
      const height = viewportHeight();
      const dpr = viewportCache.dpr;
      const surface = document.createElement("canvas");
      surface.width = Math.floor(width * dpr);
      surface.height = Math.floor(height * dpr);
      const surfaceContext = surface.getContext("2d");
      surfaceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPage(pageNum, surfaceContext, width, height, theme);
      pageSurfaces.set(pageNum, surface);
      return surface;
    }

    function trimPageSurfaces(centerPage) {
      for (const cachedPage of pageSurfaces.keys()) {
        if (Math.abs(cachedPage - centerPage) > SURFACE_RADIUS) pageSurfaces.delete(cachedPage);
      }
    }

    function cancelPrewarm() {
      if (prewarmTimer !== null) {
        clearTimeout(prewarmTimer);
        prewarmTimer = null;
      }
    }

    function schedulePrewarm() {
      cancelPrewarm();
      if (isAnimating || disposed) return;
      prewarmTimer = setTimeout(() => {
        prewarmTimer = null;
        if (isAnimating || disposed) return;
        trimPageSurfaces(page);
        if (page > 1) getPageSurface(page - 1);
        if (page < totalPages()) getPageSurface(page + 1);
        trimPageSurfaces(page);
      }, 40);
    }

    function paintBackground(theme) {
      document.body.style.background = theme.bg;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, viewportWidth(), viewportHeight());
    }

    function drawSurface(surface, x = 0, y = 0) {
      ctx.drawImage(surface, x, y, viewportWidth(), viewportHeight());
    }

    function render() {
      const theme = themes[settings.theme] || themes.paper;
      paintBackground(theme);
      drawSurface(getPageSurface(page));
      dogear.style.display = "none";
      schedulePrewarm();
    }

    function drawSlideShadow(axis, edge, progress) {
      const strength = Math.sin(Math.PI * progress);
      if (strength <= 0) return;
      const shadowSize = 44;
      let gradient;
      if (axis === "vertical") {
        gradient = ctx.createLinearGradient(0, edge - shadowSize, 0, edge);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0," + (.28 * strength) + ")");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, edge - shadowSize, viewportWidth(), shadowSize);
      } else {
        gradient = ctx.createLinearGradient(edge - shadowSize, 0, edge, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0," + (.28 * strength) + ")");
        ctx.fillStyle = gradient;
        ctx.fillRect(edge - shadowSize, 0, shadowSize, viewportHeight());
      }
    }

    function renderSlide(progress, previous, axis, fromPage, targetPage) {
      const theme = themes[settings.theme] || themes.paper;
      const width = viewportWidth();
      const height = viewportHeight();
      const distance = axis === "vertical" ? height : width;
      const offset = progress * distance;
      paintBackground(theme);

      if (previous) {
        drawSurface(getPageSurface(targetPage));
        const x = axis === "horizontal" ? offset : 0;
        const y = axis === "vertical" ? offset : 0;
        drawSurface(getPageSurface(fromPage), x, y);
        drawSlideShadow(axis, offset, progress);
      } else {
        drawSurface(getPageSurface(fromPage));
        const position = distance - offset;
        drawSlideShadow(axis, position, progress);
        const x = axis === "horizontal" ? position : 0;
        const y = axis === "vertical" ? position : 0;
        drawSurface(getPageSurface(targetPage), x, y);
      }
    }

    function bookGeometry(u, progress, previous) {
      const width = viewportWidth();
      const height = viewportHeight();
      const baseAngle = previous ? Math.PI * (1 - progress) : Math.PI * progress;
      const curl = Math.sin(Math.PI * progress) * (u - .5) * .52 * (previous ? -1 : 1);
      const angle = baseAngle + curl;
      const depth = Math.sin(angle) * u * width;
      const perspective = 1250 / (1250 + Math.max(0, depth) * .32);
      const projectedX = u * width * Math.cos(angle) * perspective;
      const lift = Math.max(0, depth) * .12;
      const lowerLean = -Math.max(0, depth) * .085;
      return {
        angle,
        topX: projectedX,
        topY: lift * .08,
        bottomX: projectedX + lowerLean,
        bottomY: height - lift * .18,
      };
    }

    function drawBookShadow(progress, previous) {
      const strength = Math.sin(Math.PI * progress);
      if (strength <= 0) return;
      const edge = bookGeometry(1, progress, previous);
      const x = Math.max(0, Math.min(viewportWidth(), (edge.topX + edge.bottomX) / 2));
      const size = 34 + 70 * strength;
      const gradient = ctx.createLinearGradient(x, 0, x + size, 0);
      gradient.addColorStop(0, "rgba(0,0,0," + (.38 * strength) + ")");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, size, viewportHeight());

      const spine = ctx.createLinearGradient(0, 0, 54, 0);
      spine.addColorStop(0, "rgba(0,0,0," + (.24 * strength) + ")");
      spine.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spine;
      ctx.fillRect(0, 0, 54, viewportHeight());
    }

    function drawBookSheet(surface, progress, previous, theme) {
      const width = viewportWidth();
      const height = viewportHeight();
      const dpr = viewportCache.dpr;
      const stripWidth = Math.max(8, Math.ceil(width / 56));
      for (let sourceX = 0; sourceX < width; sourceX += stripWidth) {
        const sourceWidth = Math.min(stripWidth + 1, width - sourceX);
        const left = bookGeometry(sourceX / width, progress, previous);
        const right = bookGeometry(Math.min(1, (sourceX + sourceWidth) / width), progress, previous);
        const a = (right.topX - left.topX) / sourceWidth;
        const b = (right.topY - left.topY) / sourceWidth;
        const c = (left.bottomX - left.topX) / height;
        const d = (left.bottomY - left.topY) / height;
        const shade = Math.sin(Math.PI * progress) * (.08 + .24 * (1 - Math.abs(Math.cos(left.angle))));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left.topX, left.topY);
        ctx.lineTo(right.topX, right.topY);
        ctx.lineTo(right.bottomX, right.bottomY);
        ctx.lineTo(left.bottomX, left.bottomY);
        ctx.closePath();
        ctx.clip();
        ctx.transform(a, b, c, d, left.topX, left.topY);
        if (Math.cos(left.angle) >= 0) {
          ctx.drawImage(
            surface,
            sourceX * dpr,
            0,
            sourceWidth * dpr,
            height * dpr,
            0,
            0,
            sourceWidth,
            height
          );
        } else {
          ctx.fillStyle = theme.bg;
          ctx.fillRect(0, 0, sourceWidth, height);
        }
        ctx.fillStyle = "rgba(0,0,0," + shade + ")";
        ctx.fillRect(0, 0, sourceWidth, height);
        ctx.restore();
      }
    }

    function renderBook(progress, previous, fromPage, targetPage) {
      const theme = themes[settings.theme] || themes.paper;
      paintBackground(theme);
      drawSurface(getPageSurface(previous ? fromPage : targetPage));
      drawBookShadow(progress, previous);
      drawBookSheet(getPageSurface(previous ? targetPage : fromPage), progress, previous, theme);
    }

    function renderBoundaryFrame(amount, axis) {
      const theme = themes[settings.theme] || themes.paper;
      paintBackground(theme);
      const x = axis === "horizontal" ? amount : 0;
      const y = axis === "vertical" ? amount : 0;
      drawSurface(getPageSurface(page), x, y);
    }

    function boundary(message, delta, axis) {
      if (isAnimating) return;
      const now = Date.now();
      if (now - lastBoundaryFeedback < 300) return;
      lastBoundaryFeedback = now;
      isAnimating = true;
      let startedAt = null;
      const run = (time) => {
        if (startedAt === null) startedAt = time;
        const progressValue = Math.min(1, (time - startedAt) / BOUNDARY_DURATION);
        const amount = Math.sin(progressValue * Math.PI) * (delta < 0 ? 12 : -12);
        renderBoundaryFrame(amount, axis);
        if (progressValue < 1) {
          animationFrame = requestAnimationFrame(run);
        } else {
          animationFrame = null;
          render();
          isAnimating = false;
        }
      };
      animationFrame = requestAnimationFrame(run);
      toast.textContent = message;
      toast.style.opacity = "1";
      setTimeout(() => toast.style.opacity = "0", 1100);
      post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), boundary: true, message, preview: previewText() });
    }

    function playSyntheticTurn(previous) {
      if (settings.pageTurnFeedback !== "sound") return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audio = new AudioContext();
        const duration = previous ? .14 : .19;
        const buffer = audio.createBuffer(1, Math.max(1, audio.sampleRate * duration), audio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / data.length;
          const envelope = Math.sin(Math.PI * t) * Math.pow(1 - t, .8);
          data[i] = (Math.random() * 2 - 1) * envelope * .12;
        }
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(previous ? 900 : 1600, audio.currentTime);
        filter.frequency.exponentialRampToValueAtTime(previous ? 1800 : 3100, audio.currentTime + duration);
        gain.gain.value = .45;
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audio.destination);
        source.start();
        source.onended = () => audio.close();
      } catch {}
    }

    function animateTurn(previous, axis) {
      if (isAnimating) return;
      const style = settings.pageTurnStyle;
      const oldPage = page;
      const targetPage = page + (previous ? -1 : 1);
      if (style === "none") {
        page = targetPage;
        render();
        post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), completed: page === totalPages(), preview: previewText(), previousPage: oldPage, offset: starts[page - 1] || 0 });
        return;
      }

      getPageSurface(oldPage);
      getPageSurface(targetPage);
      isAnimating = true;
      pointer = null;
      clearTimeout(longPressTimer);
      dogear.style.display = "none";
      let startedAt = null;
      const run = (time) => {
        if (startedAt === null) startedAt = time;
        const t = Math.min(1, (time - startedAt) / TURN_DURATION);
        const ease = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (style === "slide") {
          renderSlide(ease, previous, axis, oldPage, targetPage);
        } else if (style === "curl") {
          renderBook(ease, previous, oldPage, targetPage);
        }
        if (t < 1) {
          animationFrame = requestAnimationFrame(run);
        } else {
          animationFrame = null;
          page = targetPage;
          trimPageSurfaces(page);
          isAnimating = false;
          render();
          post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), completed: page === totalPages(), preview: previewText(), previousPage: oldPage, offset: starts[page - 1] || 0 });
        }
      };
      playSyntheticTurn(previous);
      animationFrame = requestAnimationFrame(run);
    }

    function go(delta, axis = "horizontal") {
      if (isAnimating) return;
      if (delta < 0 && page <= 1) return boundary("첫 페이지입니다", delta, axis);
      if (delta > 0 && page >= totalPages()) return boundary("마지막 페이지입니다", delta, axis);
      animateTurn(delta < 0, axis);
    }

    function goToPage(nextPage, requestId) {
      if (isAnimating) return;
      page = Math.min(totalPages(), Math.max(1, Math.round(nextPage)));
      pageSurfaces.delete(page);
      trimPageSurfaces(page);
      render();
      post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText(), offset: starts[page - 1] || 0 }, requestId);
    }

    function goToOffset(offset, requestId) {
      goToPage(pageForOffset(offset), requestId);
    }

    function toggleBookmark(requestId) {
      if (isAnimating) return;
      const bookmarks = Array.isArray(documentData.bookmarks) ? documentData.bookmarks : [];
      const current = bookmarkForPage(page);
      const active = Boolean(current);
      const anchorOffset = starts[page - 1] || 0;
      const bookmark = current || {
        bookmarkId: "local-" + Date.now(),
        documentId: documentData.documentId,
        page,
        totalPages: totalPages(),
        progress: progress(),
        preview: previewText(),
        createdAt: Date.now(),
        anchorOffset,
      };
      if (active) documentData.bookmarks = bookmarks.filter(item => item.bookmarkId !== current.bookmarkId);
      else documentData.bookmarks = [...bookmarks, bookmark];
      pageSurfaces.delete(page);
      render();
      post("bookmarkChanged", {
        active: !active,
        bookmarkId: bookmark.bookmarkId,
        page,
        totalPages: totalPages(),
        progress: progress(),
        preview: previewText(),
        anchorOffset,
      }, requestId);
    }

    function requestMenu(source) {
      if (isAnimating) return;
      post("menuRequested", { source, currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText() });
    }

    function handleMessage(raw) {
      let message;
      try { message = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }
      if (message?.version !== 1 || !allowedIncoming.has(message.type)) return;
      if (message.type === "disposeDocument") {
        disposed = true;
        cancelPrewarm();
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
        isAnimating = false;
      }
      if (message.type === "initializeDocument") {
        documentData = message.payload;
        settings = message.payload.settings || settings;
        settingsKey = message.payload.settingsKey || settingsKey;
        page = message.payload.initialPage || 1;
        disposed = false;
        pageSurfaces.clear();
        void paginateInline();
      }
      if (message.type === "updateSettings") {
        if (isAnimating) return;
        const nextSettings = message.payload.settings || message.payload;
        settingsKey = message.payload.settingsKey || settingsKey;
        const needsPagination = paginationSettingsChanged(settings, nextSettings);
        const needsRender = visualSettingsChanged(settings, nextSettings);
        settings = nextSettings;
        resetGlyphWidthCache();
        if (needsPagination) {
          pageSurfaces.clear();
          targetOffset = starts[page - 1] || 0;
          void paginateInline();
        } else if (needsRender) {
          pageSurfaces.clear();
          render();
        } else {
          schedulePrewarm();
        }
      }
      if (message.type === "goToPage") goToPage(message.payload.page, message.requestId);
      if (message.type === "goToOffset") goToOffset(message.payload.offset, message.requestId);
      if (message.type === "turnPage") go(message.payload.delta, message.payload.axis || "horizontal");
      if (message.type === "toggleBookmark") toggleBookmark(message.requestId);
    }

    canvas.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) return;
      if (!settings.pageTurnTouch || isAnimating) return;
      const w = viewportWidth();
      const h = viewportHeight();
      const nx = event.clientX / w - .5;
      const ny = event.clientY / h - .5;
      if (Math.abs(nx) >= Math.abs(ny)) {
        go(nx >= 0 ? 1 : -1, "horizontal");
      } else {
        go(ny >= 0 ? 1 : -1, "vertical");
      }
    });
    canvas.addEventListener("contextmenu", event => {
      event.preventDefault();
      requestMenu("contextMenu");
    });
    canvas.addEventListener("pointerdown", event => {
      if (isAnimating) return;
      pointer = { x:event.clientX, y:event.clientY, time:Date.now(), moved:false };
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        pointer = null;
        suppressClickUntil = Date.now() + 500;
        requestMenu("longPress");
      }, 560);
    });
    canvas.addEventListener("pointermove", event => {
      if (!pointer || isAnimating) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        pointer.moved = true;
        clearTimeout(longPressTimer);
      }
    });
    canvas.addEventListener("pointerup", event => {
      clearTimeout(longPressTimer);
      if (!pointer) return;
      const startPointer = pointer;
      pointer = null;
      if (!settings.pageTurnSwipe || isAnimating) return;
      const dx = event.clientX - startPointer.x;
      const dy = event.clientY - startPointer.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 52) return;
      suppressClickUntil = Date.now() + 450;
      if (Math.abs(dx) > Math.abs(dy)) {
        go(dx < 0 ? 1 : -1, "horizontal");
      } else {
        go(dy < 0 ? 1 : -1, "vertical");
      }
    });
    canvas.addEventListener("pointercancel", () => {
      pointer = null;
      clearTimeout(longPressTimer);
    });
    window.addEventListener("keydown", event => {
      if (isAnimating) return;
      if (event.key === "Escape") {
        event.preventDefault();
        post("backRequested", { source: "escape", currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText() });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1, "horizontal");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1, "horizontal");
      } else if (event.key === "ArrowDown" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        go(1, "vertical");
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        go(-1, "vertical");
      }
    });
    let wheelTimeout;
    window.addEventListener("wheel", event => {
      if (wheelTimeout || isAnimating) return;
      if (Math.abs(event.deltaY) > 10) {
        go(event.deltaY > 0 ? 1 : -1, "vertical");
        wheelTimeout = setTimeout(() => wheelTimeout = null, 300);
      }
    }, { passive: true });
    window.addEventListener("message", event => handleMessage(event.data));
    document.addEventListener("message", event => handleMessage(event.data));
    window.addEventListener("resize", resize);
    resize();
  </script>
</body>
</html>`;
}
