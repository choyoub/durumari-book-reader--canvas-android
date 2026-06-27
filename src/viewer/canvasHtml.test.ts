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
    });
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(script).toBeDefined();
    expect(() => new Function(script!)).not.toThrow();
    expect(html).toContain("const TURN_DURATION = 380");
    expect(html).toContain("let paginationRunId = 0");
    expect(html).toContain("document.fonts?.ready");
    expect(html).toContain("function renderSlide(");
    expect(html).toContain("function renderBook(");
    expect(html).toContain("function drawBookSheet(");
    expect(html).toContain("if (isAnimating) return");
    expect(html).toContain('go(nx >= 0 ? 1 : -1, "horizontal")');
    expect(html).toContain('go(ny >= 0 ? 1 : -1, "vertical")');
  });
});
