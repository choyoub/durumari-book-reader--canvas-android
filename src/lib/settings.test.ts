import { resolveActiveFolderId, themeTokens } from "./settings";

describe("resolveActiveFolderId", () => {
  it("selects the first folder when there is no saved selection", () => {
    expect(resolveActiveFolderId(["first", "second"], null)).toBe("first");
  });

  it("restores a saved folder when it still exists", () => {
    expect(resolveActiveFolderId(["first", "second"], "second")).toBe("second");
  });

  it("falls back to the first folder when the saved folder was removed", () => {
    expect(resolveActiveFolderId(["first", "second"], "removed")).toBe("first");
  });
});

describe("themeTokens", () => {
  it("includes the chalk theme with readable accent foreground", () => {
    expect(themeTokens.chalk.bg).toBe("#1F3F38");
    expect(themeTokens.chalk.accent).toBe("#D6C58A");
    expect(themeTokens.chalk.accentForeground).toBe("#1F3F38");
  });
});
