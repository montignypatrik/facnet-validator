/**
 * XSS Sanitization Utilities
 *
 * Prevents XSS attacks in user-generated content (task descriptions, comments).
 * Uses DOMPurify for HTML sanitization.
 *
 * Security Priority: CRITICAL
 *
 * All rich text content MUST be sanitized before:
 * - Saving to database
 * - Displaying to users
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * Allowed tags:
 * - Text formatting: bold, italic, underline, strikethrough
 * - Lists: ordered, unordered
 * - Links: with safe protocols only (https, http, mailto)
 * - Headings: h1-h6
 * - Code blocks
 *
 * Blocked:
 * - Scripts
 * - Event handlers (onclick, onerror, etc.)
 * - Iframes, objects, embeds
 * - Form elements
 * - Styles (inline CSS)
 *
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML string safe for display
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',

      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

      // Lists
      'ul', 'ol', 'li',

      // Links (sanitized)
      'a',

      // Block quotes
      'blockquote',

      // Code
      'code', 'pre',
    ],

    ALLOWED_ATTR: [
      'href', // Links only
      'title', // Link titles
      'target', // Link targets (will be forced to _blank)
    ],

    // Only allow safe URL protocols
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)|^\//, // https, http, mailto, and relative URLs

    // Force external links to open in new tab
    ADD_ATTR: ['target'],

    // Prevent data URIs and javascript: protocol
    FORBID_CONTENTS: ['script', 'style'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover'], // Block event handlers and inline styles
  });
}

/**
 * Sanitize plain text (no HTML allowed)
 * Use for task titles, board names, etc.
 *
 * @param text - Untrusted text string
 * @returns Text with all HTML tags stripped
 */
export function sanitizePlainText(text: string): string {
  if (!text) return '';

  // Strip all HTML tags
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML tags
    ALLOWED_ATTR: [], // No attributes
  });
}

/**
 * Validate and sanitize task board data
 *
 * @param data - Task board data from request
 * @returns Sanitized task board data
 */
export function sanitizeTaskBoardData(data: {
  name?: string;
  description?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    name: data.name ? sanitizePlainText(data.name) : undefined,
    description: data.description ? sanitizeHtml(data.description) : undefined,
  };
}

/**
 * Validate and sanitize task data
 *
 * @param data - Task data from request
 * @returns Sanitized task data
 */
export function sanitizeTaskData(data: {
  title?: string;
  description?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    title: data.title ? sanitizePlainText(data.title) : undefined,
    description: data.description ? sanitizeHtml(data.description) : undefined,
  };
}

/**
 * Validate and sanitize comment data
 *
 * @param data - Comment data from request
 * @returns Sanitized comment data
 */
export function sanitizeCommentData(data: {
  content?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    content: data.content ? sanitizeHtml(data.content) : undefined,
  };
}

/**
 * Validate and sanitize label data
 *
 * @param data - Label data from request
 * @returns Sanitized label data
 */
export function sanitizeLabelData(data: {
  name?: string;
  color?: string;
  [key: string]: any;
}) {
  return {
    ...data,
    name: data.name ? sanitizePlainText(data.name) : undefined,
    // Color is validated separately (hex color format)
    color: data.color ? sanitizePlainText(data.color) : undefined,
  };
}

/**
 * Test XSS payload detection
 * Used in security tests
 *
 * @param text - Text to test
 * @returns True if XSS payload detected (unsafe), false if safe
 */
export function detectXSS(text: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /onload=/i,
    /onmouseover=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return xssPatterns.some(pattern => pattern.test(text));
}
