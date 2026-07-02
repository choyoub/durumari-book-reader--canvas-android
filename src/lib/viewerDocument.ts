import { DocumentRecord } from "../types";
import { hydrateDocumentFromBytes } from "./documentImport";
import { readSafBytes } from "./safImport";
import { getDocumentText, upsertDocuments } from "./store";
import { readWebTestDocumentBytes } from "./testMode";

function needsEncodingMetadata(document: DocumentRecord, stored: { textEncoding?: string; detectedTextEncoding?: string }) {
  return (
    (document.kind === "txt" || document.kind === "gz" || document.kind === "zip")
    && (!stored.textEncoding || !stored.detectedTextEncoding)
  );
}

export async function loadViewerDocument(
  document: DocumentRecord,
  forceEncoding?: string,
  options?: { bypassCache?: boolean },
) {
  if (!forceEncoding && !options?.bypassCache) {
    const stored = await getDocumentText(document.documentId);
    if (stored.text !== undefined && !needsEncodingMetadata(document, stored)) return { ...document, ...stored };
  }

  const bytes = await readWebTestDocumentBytes(document.sourceUri) ?? await readSafBytes(document.sourceUri);
  const hydrated = await hydrateDocumentFromBytes(document, bytes, forceEncoding);
  await upsertDocuments([hydrated]);
  return hydrated;
}
