export class TextCleaner {
  /**
   * Cleans and normalizes raw text extracted from documents.
   */
  static clean(text: string): string {
    if (!text) return '';

    return (
      text
        // Replace NULL bytes and weird control characters, keep newlines and tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Normalize CRLF to LF
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Replace non-breaking spaces and unusual unicode spaces
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
        // Normalize quotes and hyphens
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        // Collapse more than two consecutive newlines into double newlines
        .replace(/\n{3,}/g, '\n\n')
        // Collapse consecutive spaces and tabs (not newlines)
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    );
  }
}
