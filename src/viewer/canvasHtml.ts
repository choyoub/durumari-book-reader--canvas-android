import type { ReaderSettings } from "../types";

export interface CanvasDocumentPayload {
  documentId: string;
  title: string;
  text: string;
  initialPage?: number;
  bookmarks: number[];
  settings: ReaderSettings;
}

export function createCanvasHtml(payload: CanvasDocumentPayload) {
  const encoded = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#f2ead3; }
    canvas { display:block; width:100vw; height:100vh; touch-action:none; background:#f2ead3; }
    #toast { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); max-width:80vw; padding:8px 12px; border-radius:6px; color:#fff; background:rgba(0,0,0,.68); font:13px sans-serif; opacity:0; transition:opacity .16s; pointer-events:none; }
    #dogear { position:fixed; top:0; right:0; width:36px; height:36px; pointer-events:none; display:none; }
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
    const allowedIncoming = new Set(["initializeDocument","updateSettings","goToPage","toggleBookmark","cancelLoading","disposeDocument"]);
    let documentData = INITIAL;
    let settings = INITIAL.settings;
    let starts = [0, INITIAL.text.length];
    let page = Math.max(1, INITIAL.initialPage || 1);
    let disposed = false;
    let lastBoundaryFeedback = 0;
    let pointer = null;
    let longPressTimer = null;
    let suppressClickUntil = 0;

    const themes = {
      paper: { bg:"#F2EAD3", text:"#2A2A2A", accent:"#9A5A10", dog:"#CFBE90" },
      light: { bg:"#F8F4ED", text:"#1A1A2E", accent:"#B85C00", dog:"#E2DBCC" },
      dark: { bg:"#121212", text:"#E0E0E0", accent:"#FF9D00", dog:"#2D2D2D" }
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
      post("loadingProgress", { progress: 0, message: "전체 페이지를 계산하는 중..." });
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(160, Math.floor(canvas.width / dpr) - settings.paddingLeft - settings.paddingRight);
      const height = Math.max(160, Math.floor(canvas.height / dpr) - settings.paddingTop - settings.paddingBottom);
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
      page = Math.min(Math.max(1, page), totalPages());
      render();
      post("loadingProgress", { progress: 1, message: "준비 완료" });
      post("ready", { totalPages: totalPages(), currentPage: page, progress: progress(), title: documentData.title });
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

    function render(offsetX = 0, curl = 0) {
      const theme = themes[settings.theme] || themes.paper;
      const width = window.innerWidth;
      const height = window.innerHeight;
      document.body.style.background = theme.bg;
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(offsetX, 0);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = theme.text;
      ctx.font = (settings.isBold ? "700 " : "400 ") + settings.fontSize + "px " + settings.fontFamily;
      ctx.textBaseline = "top";
      const contentWidth = Math.max(160, width - settings.paddingLeft - settings.paddingRight);
      const current = (documentData.text || "").slice(starts[page - 1], starts[page]);
      const lines = pageLines(current, contentWidth);
      let y = settings.paddingTop;
      for (const line of lines) {
        ctx.fillText(line, settings.paddingLeft, y);
        y += settings.fontSize * settings.lineHeight;
      }
      if (curl > 0) {
        const fold = Math.min(44, curl);
        const x = width - fold;
        ctx.fillStyle = theme.dog;
        ctx.beginPath();
        ctx.moveTo(width, height);
        ctx.lineTo(x, height);
        ctx.lineTo(width, height - fold);
        ctx.closePath();
        ctx.fill();
        const gradient = ctx.createLinearGradient(x, height - fold, width, height);
        gradient.addColorStop(0, "rgba(255,255,255,.20)");
        gradient.addColorStop(1, "rgba(0,0,0,.22)");
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      ctx.restore();
      drawDogear();
    }

    function drawDogear() {
      const marked = documentData.bookmarks.includes(page);
      dogear.style.display = marked ? "block" : "none";
      if (!marked) return;
      const theme = themes[settings.theme] || themes.paper;
      const dpr = window.devicePixelRatio || 1;
      dogear.width = 36 * dpr;
      dogear.height = 36 * dpr;
      dog.setTransform(dpr, 0, 0, dpr, 0, 0);
      dog.clearRect(0, 0, 36, 36);
      dog.fillStyle = theme.dog;
      dog.beginPath();
      dog.moveTo(0, 0);
      dog.lineTo(36, 0);
      dog.lineTo(36, 36);
      dog.closePath();
      dog.fill();
      dog.fillStyle = theme.bg;
      dog.beginPath();
      dog.moveTo(0, 0);
      dog.lineTo(0, 36);
      dog.lineTo(36, 36);
      dog.closePath();
      dog.fill();
    }

    function boundary(message) {
      const now = Date.now();
      if (now - lastBoundaryFeedback < 300) return;
      lastBoundaryFeedback = now;
      if (settings.pageTurnStyle === "slide") {
        let start = performance.now();
        const run = (time) => {
          const t = Math.min(1, (time - start) / 150);
          const amount = Math.sin(t * Math.PI) * (message.startsWith("첫") ? 12 : -12);
          render(amount, 0);
          if (t < 1) requestAnimationFrame(run);
          else render();
        };
        requestAnimationFrame(run);
      } else {
        render(0, 10);
        setTimeout(() => render(), 130);
      }
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

    function animateTurn(previous) {
      const style = settings.pageTurnStyle;
      const from = performance.now();
      const duration = style === "curl" ? 340 : 220;
      const oldPage = page;
      page += previous ? -1 : 1;
      const run = (time) => {
        const t = Math.min(1, (time - from) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        if (style === "slide") {
          render((previous ? -1 : 1) * (1 - ease) * window.innerWidth, 0);
        } else if (style === "curl") {
          render(0, (1 - ease) * 42);
        } else {
          render();
        }
        if (t < 1) requestAnimationFrame(run);
        else {
          render();
          post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), completed: page === totalPages(), preview: previewText(), previousPage: oldPage });
        }
      };
      playSyntheticTurn(previous);
      requestAnimationFrame(run);
    }

    function go(delta) {
      if (delta < 0 && page <= 1) return boundary("첫 페이지입니다");
      if (delta > 0 && page >= totalPages()) return boundary("마지막 페이지입니다");
      animateTurn(delta < 0);
    }

    function goToPage(nextPage, requestId) {
      page = Math.min(totalPages(), Math.max(1, Math.round(nextPage)));
      render();
      post("pageChanged", { currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText() }, requestId);
    }

    function toggleBookmark(requestId) {
      const index = documentData.bookmarks.indexOf(page);
      const active = index >= 0;
      if (active) documentData.bookmarks.splice(index, 1);
      else documentData.bookmarks.push(page);
      render();
      post("bookmarkChanged", { active: !active, page, totalPages: totalPages(), progress: progress(), preview: previewText() }, requestId);
    }

    function requestMenu(source) {
      post("menuRequested", { source, currentPage: page, totalPages: totalPages(), progress: progress(), preview: previewText() });
    }

    function handleMessage(raw) {
      let message;
      try { message = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }
      if (message?.version !== 1 || !allowedIncoming.has(message.type)) return;
      if (message.type === "disposeDocument") disposed = true;
      if (message.type === "initializeDocument") {
        documentData = message.payload;
        settings = message.payload.settings || settings;
        page = message.payload.initialPage || 1;
        disposed = false;
        void paginateInline();
      }
      if (message.type === "updateSettings") {
        settings = message.payload.settings;
        page = Math.max(1, Math.round((message.payload.progress || progress()) * Math.max(1, totalPages() - 1)) + 1);
        void paginateInline();
      }
      if (message.type === "goToPage") goToPage(message.payload.page, message.requestId);
      if (message.type === "toggleBookmark") toggleBookmark(message.requestId);
    }

    canvas.addEventListener("click", event => {
      if (Date.now() < suppressClickUntil) return;
      if (!settings.pageTurnTouch) return;
      if (event.clientX < window.innerWidth * .45) go(-1);
      else go(1);
    });
    canvas.addEventListener("contextmenu", event => {
      event.preventDefault();
      requestMenu("contextMenu");
    });
    canvas.addEventListener("pointerdown", event => {
      pointer = { x:event.clientX, y:event.clientY, time:Date.now() };
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        pointer = null;
        suppressClickUntil = Date.now() + 500;
        requestMenu("longPress");
      }, 560);
    });
    canvas.addEventListener("pointermove", event => {
      if (!pointer) return;
      if (Math.abs(event.clientX - pointer.x) > 8 || Math.abs(event.clientY - pointer.y) > 8) {
        clearTimeout(longPressTimer);
      }
    });
    canvas.addEventListener("pointerup", event => {
      clearTimeout(longPressTimer);
      if (!settings.pageTurnSwipe || !pointer) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 52) return;
      go((dx < 0 || dy < 0) ? 1 : -1);
    });
    canvas.addEventListener("pointercancel", () => clearTimeout(longPressTimer));
    window.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestMenu("escape");
      } else if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    });
    window.addEventListener("message", event => handleMessage(event.data));
    document.addEventListener("message", event => handleMessage(event.data));
    window.addEventListener("resize", resize);
    resize();
  </script>
</body>
</html>`;
}
