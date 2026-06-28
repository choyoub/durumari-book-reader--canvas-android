import { createCanvasHtml } from "./canvasHtml";

describe("canvasHtml", () => {
  it("should generate html string containing pagination logic", () => {
    const html = createCanvasHtml({
      documentId: "1",
      title: "test",
      text: "hello",
      bookmarks: [],
      settings: {} as any,
      initialPage: 1
    });
    expect(html).toContain("function paginateInline");
    expect(html).toContain("function render(");
  });

  it("embeds saved reader settings and resolved font assets", () => {
    const html = createCanvasHtml({
      documentId: "saved-settings",
      title: "test",
      text: "hello",
      bookmarks: [],
      settings: {
        fontFamily: "MaruBuri, serif",
        fontSize: 24,
        theme: "dark",
      } as any,
      fontUris: { MaruBuri: "file:///data/user/0/app/cache/MaruBuri.ttf" },
    });

    expect(html).toContain('"fontFamily":"MaruBuri, serif"');
    expect(html).toContain('"fontSize":24');
    expect(html).toContain('"theme":"dark"');
    expect(html).toContain("font-family: 'MaruBuri'");
    expect(html).toContain("file:///data/user/0/app/cache/MaruBuri.ttf");
  });

  it("includes the chalk reader palette", () => {
    const html = createCanvasHtml({
      documentId: "chalk-settings",
      title: "test",
      text: "hello",
      bookmarks: [],
      settings: { theme: "chalk" } as any,
    });

    expect(html).toContain('"theme":"chalk"');
    expect(html).toContain('chalk: { bg:"#183b32"');
  });

  it("builds a synchronized paper transition engine with valid JavaScript", () => {
    const html = createCanvasHtml({
      documentId: "motion",
      title: "motion test",
      text: "first page\n".repeat(500),
      bookmarks: [],
      settings: {
        pageTurnStyle: "slide",
        pageTurnTouch: true,
        pageTurnSwipe: true,
      } as any,
      settingsKey: "motion-settings",
    });
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(script).toBeDefined();
    expect(() => new Function(script!)).not.toThrow();
    expect(html).toContain("const TURN_DURATION = 380");
    expect(html).toContain("let paginationRunId = 0");
    expect(html).toContain("const MAX_RENDER_DPR = 2");
    expect(html).toContain("function schedulePrewarm(");
    expect(html).toContain("function pageLineRanges(");
    expect(html).toContain('let settingsKey = INITIAL.settingsKey || ""');
    expect(html).toContain('"settingsKey":"motion-settings"');
    expect(html).toContain("document.fonts?.load");
    expect(html).toContain("document.fonts?.ready");
    expect(html).toContain("settingsKey");
    expect(html).toContain("function renderSlide(");
    expect(html).toContain("function renderBook(");
    expect(html).toContain("function drawBookSheet(");
    expect(html).toContain("if (isAnimating) return");
    expect(html).toContain('go(nx >= 0 ? 1 : -1, "horizontal")');
    expect(html).toContain('go(ny >= 0 ? 1 : -1, "vertical")');
  });

  it("embeds bookmark anchor sync and target bookmark navigation", () => {
    const html = createCanvasHtml({
      documentId: "bookmarks",
      title: "bookmark test",
      text: "first page\nsecond page\nthird page\n".repeat(80),
      initialPage: 1,
      targetBookmarkId: "bookmark-1",
      bookmarks: [{
        bookmarkId: "bookmark-1",
        documentId: "bookmarks",
        page: 1,
        totalPages: 1,
        progress: 0,
        preview: "second page",
        createdAt: 1,
        anchorOffset: null,
      }],
      settings: {
        fontFamily: "NanumGothic",
        fontSize: 18,
        isBold: false,
        lineHeight: 1.6,
        letterSpacing: 0,
        paddingTop: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        theme: "paper",
        pageTurnStyle: "none",
      } as any,
      settingsKey: "bookmark-settings",
    });
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(script).toBeDefined();
    expect(() => new Function(script!)).not.toThrow();
    expect(html).toContain('"targetBookmarkId":"bookmark-1"');
    expect(html).toContain("function resolveAnchorOffset");
    expect(html).toContain("function syncReading");
    expect(html).toContain("function syncBookmarks");
    expect(html).toContain('post("readingSynced"');
    expect(html).toContain('post("bookmarksSynced"');
    expect(html).toContain("documentData.targetBookmarkId");
    expect(html).toContain("bookmark.totalPages !== totalPages()");
    expect(html).toContain("reading.totalPages !== totalPages()");
    expect(html).toContain("anchorOffset");
  });
});
