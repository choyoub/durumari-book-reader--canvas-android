import { documentFromBytes, hydrateDocumentFromBytes } from "./documentImport";
import { Buffer } from "buffer";
import iconv from "iconv-lite";

describe("documentImport", () => {
  const input = (name: string, bytes: Uint8Array, forceEncoding?: string) => ({
    uri: `file:///test/${name}`,
    name,
    folderId: "test-folder",
    modifiedAt: 0,
    bytes,
    forceEncoding,
  });

  it("should extract text from txt files using UTF-8", async () => {
    const text = "안녕하세요 두루마리입니다.";
    const buffer = Buffer.from(text, "utf-8");
    const doc = await documentFromBytes(input("test.txt", new Uint8Array(buffer)));
    expect(doc.title).toBe("test");
    expect(doc.text).toBe(text);
    expect(doc.textEncoding).toBe("utf8");
    expect(doc.textEncodingSource).toBe("auto");
    expect(doc.detectedTextEncoding).toBe("utf8");
  });

  it("should handle EUC-KR encoding for txt files", async () => {
    const text = "EUC-KR 테스트";
    const buffer = iconv.encode(text, "euc-kr");
    const doc = await documentFromBytes(input("euc.txt", new Uint8Array(buffer), "euc-kr"));
    expect(doc.title).toBe("euc");
    expect(doc.text).toBe(text);
    expect(doc.textEncoding).toBe("euc-kr");
    expect(doc.textEncodingSource).toBe("auto");
    expect(doc.detectedTextEncoding).toBe("euc-kr");
  });

  it("should keep manual source when forced encoding differs from detected encoding", async () => {
    const text = "UTF-8 강제 변경 테스트";
    const buffer = Buffer.from(text, "utf-8");
    const doc = await documentFromBytes(input("forced.txt", new Uint8Array(buffer), "cp949"));
    expect(doc.textEncoding).toBe("cp949");
    expect(doc.textEncodingSource).toBe("manual");
    expect(doc.detectedTextEncoding).toBe("utf8");
  });

  it("should store automatically detected UTF-16 encoding", async () => {
    const text = "UTF-16 테스트";
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, "utf16-le")]);
    const doc = await documentFromBytes(input("utf16.txt", new Uint8Array(buffer)));
    expect(doc.text).toBe(text);
    expect(doc.textEncoding).toBe("utf16-le");
    expect(doc.textEncodingSource).toBe("auto");
    expect(doc.detectedTextEncoding).toBe("utf16-le");
  });

  it("should fail gracefully for unsupported extensions", async () => {
    const buffer = Buffer.from("dummy", "utf-8");
    await expect(documentFromBytes(input("test.pdf", new Uint8Array(buffer)))).rejects.toThrow("지원하지 않는 파일 형식입니다");
  });

  it("hydrates a scanned document without changing its identity", async () => {
    const scanned = {
      documentId: "stable-document-id",
      folderId: "test-folder",
      sourceUri: "content://test/book.txt",
      title: "book",
      kind: "txt" as const,
      fileSize: 0,
      modifiedAt: 123,
      contentHash: "uri-hash",
    };

    const hydrated = await hydrateDocumentFromBytes(
      scanned,
      new Uint8Array(Buffer.from("loaded text", "utf-8")),
    );

    expect(hydrated.documentId).toBe(scanned.documentId);
    expect(hydrated.sourceUri).toBe(scanned.sourceUri);
    expect(hydrated.text).toBe("loaded text");
    expect(hydrated.fileSize).toBeGreaterThan(0);
  });
});
