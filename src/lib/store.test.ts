import { readingStatus } from "../types";

describe("store domain logic", () => {
  describe("readingStatus", () => {
    it("should return unread for missing record or page <= 1", () => {
      expect(readingStatus(undefined)).toBe("unread");
      expect(readingStatus({ documentId: "1", lastPage: 1, totalPages: 10, progress: 0, openedAt: 0, completed: false })).toBe("unread");
    });

    it("should return completed if completed flag is true", () => {
      expect(readingStatus({ documentId: "1", lastPage: 5, totalPages: 10, progress: 0.5, openedAt: 0, completed: true })).toBe("completed");
      expect(readingStatus({ documentId: "1", lastPage: 1, totalPages: 1, progress: 0, openedAt: 0, completed: true })).toBe("completed");
    });

    it("should return completed if lastPage >= totalPages and totalPages > 1", () => {
      expect(readingStatus({ documentId: "1", lastPage: 10, totalPages: 10, progress: 1, openedAt: 0, completed: false })).toBe("completed");
    });

    it("should return reading otherwise", () => {
      expect(readingStatus({ documentId: "1", lastPage: 5, totalPages: 10, progress: 0.5, openedAt: 0, completed: false })).toBe("reading");
    });
  });
});
