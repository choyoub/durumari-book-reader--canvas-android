import { resolveActiveFolderId } from "./settings";

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
