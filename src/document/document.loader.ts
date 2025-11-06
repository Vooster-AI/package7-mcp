import { MarkdownDocumentFetcher } from "./markdown-document.fetcher.js";
import { Document } from "./document.js";
import { RawDocs } from "./types.js";

export class DocumentLoader {
  private documentId: number = 0;
  private readonly links: string[] = [];
  private readonly documents: Map<string, Document> =
    new Map();

  constructor(
    private readonly _rawDocs: RawDocs[],
    private readonly _documentFetcher: MarkdownDocumentFetcher
  ) {
    this._rawDocs.forEach((doc) => {
      if (doc.link) {
        this.links.push(doc.link);
      }
    });
  }

  async load(): Promise<void> {
    await this.collectAll();
  }

  getDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  private async collectAll() {
    await Promise.all(
      this._rawDocs.map(async (docs) => {
        try {
          if (this.documents.has(docs.link)) {
            return;
          }

          const document = await this.collect(docs);

          this.documents.set(docs.link, document);
        } catch (error) {
          console.error(`Failed to fetch document from ${docs.link}:`, error);
        }
      })
    );
  }

  private async collect(docs: RawDocs) {
    const document = await this._documentFetcher.fetch(docs.link);

    const keywordSet = new Set<string>();

    document.metadata.keyword.forEach((keyword) => {
      keywordSet.add(keyword.toLowerCase());
      keywordSet.add(keyword.toUpperCase());
      keywordSet.add(keyword);
    });

    const newDocument = new Document(
      keywordSet,
      document,
      docs.version,
      this.documentId++,
      docs.category
    );
    return newDocument;
  }
}
