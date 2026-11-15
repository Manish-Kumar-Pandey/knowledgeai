import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { DocumentFileType } from '../../types';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  fullText: string;
  pages: ExtractedPage[];
  metadata: {
    pageCount: number;
    author?: string;
    info?: any;
  };
}

export class DocumentExtractor {
  static async extract(buffer: Buffer, fileType: DocumentFileType): Promise<ExtractionResult> {
    switch (fileType) {
      case 'pdf':
        return this.extractPdf(buffer);
      case 'docx':
        return this.extractDocx(buffer);
      case 'txt':
      case 'md':
        return this.extractPlainText(buffer);
      default:
        throw new Error(`Unsupported document file type: ${fileType}`);
    }
  }

  private static async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const pages: ExtractedPage[] = [];
      let currentPage = 1;

      // Custom pager to split text by PDF page
      const options = {
        pagerender: function (pageData: any) {
          return pageData.getTextContent().then((textContent: any) => {
            let lastY: number | null = null;
            let text = '';
            for (const item of textContent.items) {
              if (lastY === item.transform[5] || !lastY) {
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            pages.push({ pageNumber: currentPage++, text });
            return text;
          });
        },
      };

      const parsed = await pdfParse(buffer, options);

      return {
        fullText: parsed.text || '',
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: parsed.text || '' }],
        metadata: {
          pageCount: parsed.numpages || (pages.length > 0 ? pages.length : 1),
          info: parsed.info,
        },
      };
    } catch (err: any) {
      // Fallback simple parse if custom pager encounters strange PDF objects
      const parsed = await pdfParse(buffer);
      return {
        fullText: parsed.text || '',
        pages: [{ pageNumber: 1, text: parsed.text || '' }],
        metadata: {
          pageCount: parsed.numpages || 1,
          info: parsed.info,
        },
      };
    }
  }

  private static async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value || '';
    
    // Estimate pages based on paragraph count or character count (~3000 chars per page)
    const paragraphs = fullText.split(/\n\s*\n/);
    const pages: ExtractedPage[] = [];
    let currentText = '';
    let pageNum = 1;

    for (const para of paragraphs) {
      currentText += para + '\n\n';
      if (currentText.length >= 2500) {
        pages.push({ pageNumber: pageNum++, text: currentText.trim() });
        currentText = '';
      }
    }
    if (currentText.trim().length > 0 || pages.length === 0) {
      pages.push({ pageNumber: pageNum, text: currentText.trim() });
    }

    return {
      fullText,
      pages,
      metadata: {
        pageCount: pages.length,
      },
    };
  }

  private static extractPlainText(buffer: Buffer): ExtractionResult {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    const pages: ExtractedPage[] = [];
    let current = '';
    let pageNum = 1;

    for (const line of lines) {
      current += line + '\n';
      if (current.length >= 3000) {
        pages.push({ pageNumber: pageNum++, text: current.trim() });
        current = '';
      }
    }
    if (current.trim().length > 0 || pages.length === 0) {
      pages.push({ pageNumber: pageNum, text: current.trim() });
    }

    return {
      fullText: text,
      pages,
      metadata: {
        pageCount: pages.length,
      },
    };
  }
}
