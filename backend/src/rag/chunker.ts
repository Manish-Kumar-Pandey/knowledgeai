import { ExtractedPage } from './extractors';

export interface ChunkOptions {
  strategy?: 'recursive' | 'fixed';
  chunkSize?: number; // target character count (approx 150-200 tokens for 800 chars)
  chunkOverlap?: number;
  metadata?: Record<string, any>;
}

export interface RawChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  metadata: Record<string, any>;
}

export class TextChunker {
  /**
   * Split document pages into chunks according to chosen strategy and overlap.
   */
  static chunkDocument(
    pages: ExtractedPage[],
    options: ChunkOptions = {}
  ): RawChunk[] {
    const strategy = options.strategy || 'recursive';
    const chunkSize = options.chunkSize || 800;
    const chunkOverlap = options.chunkOverlap !== undefined ? options.chunkOverlap : 150;
    const baseMetadata = options.metadata || {};

    const chunks: RawChunk[] = [];
    let globalChunkIndex = 0;

    for (const page of pages) {
      const pageText = page.text.trim();
      if (!pageText) continue;

      let pageChunks: string[] = [];

      if (strategy === 'recursive') {
        pageChunks = this.recursiveCharacterSplit(pageText, chunkSize, chunkOverlap);
      } else {
        pageChunks = this.fixedSizeSplit(pageText, chunkSize, chunkOverlap);
      }

      for (const text of pageChunks) {
        if (text.trim().length < 20) continue; // Skip trivial / whitespace chunks

        chunks.push({
          chunkIndex: globalChunkIndex++,
          pageNumber: page.pageNumber,
          content: text.trim(),
          metadata: {
            ...baseMetadata,
            pageNumber: page.pageNumber,
            charCount: text.length,
            estimatedTokens: Math.ceil(text.length / 4),
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Recursive character text splitting prioritizing paragraphs, sentences, and words.
   */
  private static recursiveCharacterSplit(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): string[] {
    const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];
    return this.splitTextRecursively(text, separators, chunkSize, chunkOverlap);
  }

  private static splitTextRecursively(
    text: string,
    separators: string[],
    chunkSize: number,
    chunkOverlap: number
  ): string[] {
    const finalChunks: string[] = [];

    // If text already fits within chunk size
    if (text.length <= chunkSize) {
      return [text];
    }

    // Find the highest-priority separator present in text
    let activeSeparator = '';
    let nextSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      if (text.includes(separators[i])) {
        activeSeparator = separators[i];
        nextSeparators = separators.slice(i + 1);
        break;
      }
    }

    // If no separator found, hard split
    if (!activeSeparator) {
      return this.fixedSizeSplit(text, chunkSize, chunkOverlap);
    }

    const splits = text.split(activeSeparator);
    let currentChunk = '';

    for (let i = 0; i < splits.length; i++) {
      const piece = splits[i];
      const candidate = currentChunk ? `${currentChunk}${activeSeparator}${piece}` : piece;

      if (candidate.length <= chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          finalChunks.push(currentChunk);
          // Calculate overlap from end of currentChunk
          const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
          const overlapText = currentChunk.slice(overlapStart);
          currentChunk = `${overlapText}${activeSeparator}${piece}`;
        } else {
          // If a single piece exceeds chunkSize, split with finer separator
          const subChunks = this.splitTextRecursively(piece, nextSeparators, chunkSize, chunkOverlap);
          finalChunks.push(...subChunks);
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      finalChunks.push(currentChunk);
    }

    return finalChunks;
  }

  /**
   * Fixed size chunking with sliding character overlap.
   */
  private static fixedSizeSplit(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      if (end >= text.length) break;
      start += chunkSize - chunkOverlap;
    }

    return chunks;
  }
}
