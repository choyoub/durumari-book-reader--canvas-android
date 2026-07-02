import { DocumentRecord } from "../types";
import { hydrateDocumentFromBytes } from "./documentImport";
import { readSafBytes } from "./safImport";
import { getDocumentText, upsertDocuments } from "./store";
import { readWebTestDocumentBytes } from "./testMode";

export async function loadViewerDocument(document: DocumentRecord, forceEncoding?: string) {
  if (!forceEncoding) {
    const stored = await getDocumentText(document.documentId);
    if (stored.text !== undefined) return { ...document, ...stored };
  }

  const bytes = await readWebTestDocumentBytes(document.sourceUri) ?? await readSafBytes(document.sourceUri);
  const hydrated = await hydrateDocumentFromBytes(document, bytes, forceEncoding);
  await upsertDocuments([hydrated]);
  return hydrated;
}
