import type { ReaderSettings } from "../types";

export interface CanvasDocumentPayload {
  documentId: string;
  title: string;
  text: string;
  initialPage?: number;
  bookmarks: number[];
  settings: ReaderSettings;
  fontUris?: Record<string, string>;
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
    html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#f2ead3; }
    canvas { display:block; width:100vw; height:100vh; touch-action:none; background:#f2ead3; }
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
    const allowedIncoming = new Set(["initializeDocument","updateSettings","goToPage","goToOffset","toggleBookmark","cancelLoading","disposeDocument"]);
    let documentData = INITIAL;
    let settings = INITIAL.settings;
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
    const pageSurfaces = new Map();
    const FOOTER_HEIGHT = 44;
    const TURN_DURATION = 380;
    const BOUNDARY_DURATION = 180;

    const themes = {
      paper: { bg:"#F2EAD3", text:"#2A2A2A", accent:"#9A5A10", dog:"#BDA66E", crease:"#8E743E" },
      light: { bg:"#F8F4ED", text:"#1A1A2E", accent:"#B85C00", dog:"#D8CDBB", crease:"#9C8F7B" },
      dark: { bg:"#121212", text:"#E0E0E0", accent:"#FF9D00", dog:"#050505", crease:"#4A4A4A" }
    };

    function post(type, payload, requestId) {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ version:1, type, requestId: requestId || null, payload }));
    }

    function glyphWidth(code, fontSize, letterSpacing, bold) {
      let ratio = 1;
      if (code === 32 || code === 9) ratio = code === 9 ? 1.32 : .33;
      else if (code < 128) {
        if ((code >= 65 && code <= 90) || (code >= 48 && code <= 57)) ratio = .6;
        else if (code >= 97 && code <= 122) ratio = .53;
        else ratio = .42;
      } else if (code >= 0x2000 && code <= 0x206f) ratio = .5;
      return fontSize * ratio * (bold ? 1.035 : 1) + letterSpacing;
    }

    async function paginateInline() {
      try {
        post("loadingProgress", { progress: 0, message: "전체 페이지를 계산하는 중..." });
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(160, Math.floor(canvas.width / dpr) - settings.paddingLeft - settings.paddingRight);
        const height = Math.max(160, Math.floor(canvas.height / dpr) - settings.paddingTop - settings.paddingBottom - FOOTER_HEIGHT);
        const maxLines = Math.max(1, Math.floor(height / Math.max(1, settings.fontSize * settings.lineHeight)));
        const nextStarts = [0];
        let line = 0;
        let lineWidth = 0;
        const text = documentData.text || "";
        for (let index = 0; index < text.length; index++) {
          if (disposed) return;
          if (index > 0 && index % 50000 === 0) {
            post("loadingProgress", { progress: Math.min(.95, index / Math.max(1, text.length)) });
            await new Promise(resolve => setTimeout(resolve, 0));
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
          const widthValue = glyphWidth(code, settings.fontSize, settings.letterSpacing, settings.isBold);
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
        if (nextStarts[nextStarts.length - 1] !== text.length) nextStarts.push(text.length);
        starts = nextStarts;
        if (targetOffset !== null) {
          let foundPage = starts.length;
          for (let i = 0; i < starts.length; i++) {
            if (targetOffset < starts[i]) {
              foundPage = i;
              break;
            }
          }
          page = Math.min(totalPages(), Math.max(1, foundPage));
          targetOffset = null;
        } else {
          page = Math.min(Math.max(1, page), totalPages());
        }
        pageSurfaces.clear();
        render();
        post("loadingProgress", { progress: 1, message: "준비 완료" });
        post("ready", { totalPages: totalPages(), currentPage: page, progress: progress(), title: documentData.title, offset: starts[page - 1] || 0 });
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

    function previewText() {
      return (documentData.text || "").slice(starts[page - 1], starts[page]).replace(/\\s+/g, " ").trim().slice(0, 80);
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pageSurfaces.clear();
      void paginateInline();
    }

    function pageLines(text, width) {
      const lines = [];
      let line = "";
      let lineWidth = 0;
      for (let index = 0; index < text.length; index++) {
        const ch = text[index];
        if (ch === "\\r") continue;
        if (ch === "\\n") {
          lines.push(line);
          line = "";
          lineWidth = 0;
          continue;
        }
        const widthValue = glyphWidth(ch.charCodeAt(0), settings.fontSize, settings.letterSpacing, settings.isBold);
        if (line && lineWidth + widthValue > width) {
          lines.push(line);
          line = "";
          lineWidth = 0;
        }
        line += ch;
        lineWidth += widthValue;
      }
      if (line) lines.push(line);
      return lines;
    }

    function drawBookmarkFold(pageNum, target, width, theme) {
      if (!documentData.bookmarks.includes(pageNum)) return;
      const size = 48;
      const fold = target.createLinearGradient(width - size, 0, width, size);
      fold.addColorStop(0, theme.dog);
      fold.addColorStop(1, theme.crease);
      target.fillStyle = fold;
      target.beginPath();
      target.moveTo(width - size, 0);
      target.lineTo(width, 0);
      target.lineTo(width, size);
      target.closePath();
      target.fill();
      target.strokeStyle = theme.crease;
      target.lineWidth = 1.5;
      target.beginPath();
      target.moveTo(width - size, 0);
      target.lineTo(width, size);
      target.stroke();
    }

    function drawPage(pageNum, target, width, height, theme) {
      if (pageNum < 1 || pageNum > totalPages()) return;
      target.fillStyle = theme.bg;
      target.fillRect(0, 0, width, height);
      target.fillStyle = theme.text;
      target.font = (settings.isBold ? "700 " : "400 ") + settings.fontSize + "px " + settings.fontFamily;
      target.textBaseline = "top";
      const contentWidth = Math.max(160, width - settings.paddingLeft - settings.paddingRight);
      const text = (documentData.text || "").slice(starts[pageNum - 1], starts[pageNum]);
      const lines = pageLines(text, contentWidth);
      let y = settings.paddingTop;
      const maxY = height - settings.paddingBottom - FOOTER_HEIGHT;
      for (const line of lines) {
        if (y + settings.fontSize > maxY) break;
        target.fillText(line, settings.paddingLeft, y);
        y += settings.fontSize * settings.lineHeight;
      }
      target.save();
      target.globalAlpha = settings.theme === "dark" ? 0.28 : 0.24;
      target.fillStyle = theme.text;
      target.font = "400 15px " + settings.fontFamily;
      target.textAlign = "center";
      target.textBaseline = "middle";
      target.fillText(pageNum + " / " + totalPages(), width / 2, height - 24);
      target.restore();
      drawBookmarkFold(pageNum, target, width, theme);
    }

    function getPageSurface(pageNum) {
      if (pageSurfaces.has(pageNum)) return pageSurfaces.get(pageNum);
      const theme = themes[settings.theme] || themes.paper;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
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
        if (Math.abs(cachedPage - centerPage) > 1) pageSurfaces.delete(cachedPage);
      }
    }

    function paintBackground(theme) {
      document.body.style.background = theme.bg;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    function drawSurface(surface, x = 0, y = 0) {
      ctx.drawImage(surface, x, y, window.innerWidth, window.innerHeight);
    }

    function render() {
      const theme = themes[settings.theme] || themes.paper;
      paintBackground(theme);
      drawSurface(getPageSurface(page));
      dogear.style.display = "none";
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
        ctx.fillRect(0, edge - shadowSize, window.innerWidth, shadowSize);
      } else {
        gradient = ctx.createLinearGradient(edge - shadowSize, 0, edge, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0," + (.28 * strength) + ")");
        ctx.fillStyle = gradient;
        ctx.fillRect(edge - shadowSize, 0, shadowSize, window.innerHeight);
      }
    }

    function renderSlide(progress, previous, axis, fromPage, targetPage) {
      const theme = themes[settings.theme] || themes.paper;
      const width = window.innerWidth;
      const height = window.innerHeight;
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
      const width = window.innerWidth;
      const height = window.innerHeight;
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
      const x = Math.max(0, Math.min(window.innerWidth, (edge.topX + edge.bottomX) / 2));
      const size = 34 + 70 * strength;
      const gradient = ctx.createLinearGradient(x, 0, x + size, 0);
      gradient.addColorStop(0, "rgba(0,0,0," + (.38 * strength) + ")");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, size, window.innerHeight);

      const spine = ctx.createLinearGradient(0, 0, 54, 0);
      spine.addColorStop(0, "rgba(0,0,0," + (.24 * strength) + ")");
      spine.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spine;
      ctx.fillRect(0, 0, 54, window.innerHeight);
    }

    function drawBookSheet(surface, progress, previous, theme) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      const stripWidth = 8;
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
          render();
          trimPageSurfaces(page);
          isAnimating = false;
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
      render();
      trimPageSurfaces(page);
      post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText(), offset: starts[page - 1] || 0 }, requestId);
    }

    function goToOffset(offset, requestId) {
      let foundPage = starts.length;
      for (let i = 0; i < starts.length; i++) {
        if (offset < starts[i]) {
          foundPage = i;
          break;
        }
      }
      goToPage(foundPage, requestId);
    }

    function toggleBookmark(requestId) {
      if (isAnimating) return;
      const index = documentData.bookmarks.indexOf(page);
      const active = index >= 0;
      if (active) documentData.bookmarks.splice(index, 1);
      else documentData.bookmarks.push(page);
      pageSurfaces.delete(page);
      render();
      post("bookmarkChanged", { active: !active, page, totalPages: totalPages(), progress: progress(), preview: previewText() }, requestId);
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
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
        isAnimating = false;
      }
      if (message.type === "initializeDocument") {
        documentData = message.payload;
        settings = message.payload.settings || settings;
        page = message.payload.initialPage || 1;
        disposed = false;
        pageSurfaces.clear();
        void paginateInline();
      }
      if (message.type === "updateSettings") {
        if (isAnimating) return;
        targetOffset = starts[page - 1] || 0;
        settings = message.payload;
        pageSurfaces.clear();
        void paginateInline();
      }
      if (message.type === "goToPage") goToPage(message.payload.page, message.requestId);
      if (message.type === "goToOffset") goToOffset(message.payload.offset, message.requestId);
      if (message.type === "toggleBookmark") toggleBookmark(message.requestId);
    }

    canvas.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) return;
      if (!settings.pageTurnTouch || isAnimating) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
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
        requestMenu("escape");
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
