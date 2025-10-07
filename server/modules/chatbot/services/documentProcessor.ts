/**
 * Document Processor Service
 *
 * Handles parsing of HTML and PDF files from the knowledge/ directory.
 * Extracts text content while preserving structure and metadata.
 */

import * as cheerio from 'cheerio';
import * as pdfParse from 'pdf-parse';
import { promises as fs } from 'fs';
import path from 'path';
import { log } from '../../../vite';

// ==================== Types ====================

export interface DocumentMetadata {
  title: string;
  language?: string;
  pageCount?: number;
  sections?: string[];
  [key: string]: any;
}

export interface ParsedDocument {
  text: string;
  metadata: DocumentMetadata;
  sections: DocumentSection[];
}

export interface DocumentSection {
  heading?: string;
  content: string;
  level?: number; // Heading level (1-6 for h1-h6)
  pageNumber?: number; // For PDFs
}

// ==================== HTML Parser ====================

/**
 * Parse HTML file and extract structured content
 *
 * @param filePath - Absolute path to HTML file
 * @returns Parsed document with text, metadata, and sections
 */
export async function parseHTML(filePath: string): Promise<ParsedDocument> {
  const startTime = Date.now();
  log(`[DocumentProcessor] Parsing HTML: ${path.basename(filePath)}`);

  try {
    // Read file with UTF-8 encoding (handles French characters)
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Extract title (from <title> or <h1>)
    const title = $('title').text().trim() || $('h1').first().text().trim() || path.basename(filePath);

    // Extract meta language
    const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || 'fr';

    // Extract sections with headings
    const sections: DocumentSection[] = [];
    const headingSelectors = 'h1, h2, h3, h4, h5, h6';

    // Process each heading and its content
    $(headingSelectors).each((index, element) => {
      const $heading = $(element);
      const heading = $heading.text().trim();
      const level = parseInt(element.tagName[1]); // h1 -> 1, h2 -> 2, etc.

      // Get content until next heading of same or higher level
      const content: string[] = [];
      let $next = $heading.next();

      while ($next.length > 0 && !$next.is(headingSelectors)) {
        const text = $next.text().trim();
        if (text) {
          content.push(text);
        }
        $next = $next.next();
      }

      if (content.length > 0) {
        sections.push({
          heading,
          content: content.join('\n\n'),
          level,
        });
      }
    });

    // If no sections found, extract all paragraph text
    if (sections.length === 0) {
      const content = $('p').map((i, el) => $(el).text().trim()).get().filter(t => t).join('\n\n');
      if (content) {
        sections.push({ content });
      }
    }

    // Combine all text
    const text = sections.map(s => {
      if (s.heading) {
        return `${s.heading}\n\n${s.content}`;
      }
      return s.content;
    }).join('\n\n');

    const duration = Date.now() - startTime;
    log(`[DocumentProcessor] HTML parsed in ${duration}ms (${sections.length} sections, ${text.length} chars)`);

    return {
      text,
      metadata: {
        title,
        language,
        sections: sections.map(s => s.heading).filter(Boolean) as string[],
      },
      sections,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[DocumentProcessor] HTML parsing failed: ${errorMessage}`);
    throw new Error(`Failed to parse HTML file: ${errorMessage}`);
  }
}

// ==================== PDF Parser ====================

/**
 * Parse PDF file and extract structured content
 *
 * @param filePath - Absolute path to PDF file
 * @returns Parsed document with text, metadata, and sections
 */
export async function parsePDF(filePath: string): Promise<ParsedDocument> {
  const startTime = Date.now();
  log(`[DocumentProcessor] Parsing PDF: ${path.basename(filePath)}`);

  try {
    // Read PDF file as buffer
    const dataBuffer = await fs.readFile(filePath);

    // Parse PDF (handles French UTF-8 text)
    const pdfData = await pdfParse(dataBuffer);

    // Extract metadata
    const title = pdfData.info?.Title || path.basename(filePath, '.pdf');
    const pageCount = pdfData.numpages;

    // Split into sections by page (simple approach)
    // Note: More sophisticated parsing could detect headers/sections
    const sections: DocumentSection[] = [];
    const text = pdfData.text;

    // Simple page-based sectioning
    // (pdf-parse doesn't provide per-page text easily, so we use full text)
    sections.push({
      content: text.trim(),
      pageNumber: 1,
    });

    const duration = Date.now() - startTime;
    log(`[DocumentProcessor] PDF parsed in ${duration}ms (${pageCount} pages, ${text.length} chars)`);

    return {
      text,
      metadata: {
        title,
        pageCount,
        language: 'fr', // Assume French for Quebec documents
      },
      sections,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[DocumentProcessor] PDF parsing failed: ${errorMessage}`);
    throw new Error(`Failed to parse PDF file: ${errorMessage}`);
  }
}

// ==================== Main Parser ====================

/**
 * Parse document based on file extension
 *
 * @param filePath - Absolute path to document
 * @returns Parsed document
 */
export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.html':
    case '.htm':
      return parseHTML(filePath);
    case '.pdf':
      return parsePDF(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}
