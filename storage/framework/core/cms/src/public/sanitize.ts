/**
 * Render-time HTML sanitizer for rich-text blocks.
 *
 * The threat model is a compromised or careless STAFF account, not arbitrary
 * public input - visitors never write block HTML. Applied at render rather
 * than at save so tightening these rules retroactively cleans every stored
 * document on the next request.
 *
 * Allow-list by removal: strips the executable surface (script/style/iframe
 * etc., inline event handlers, javascript: URLs) and leaves formatting
 * markup alone.
 */

const BLOCKED_TAGS = /<\/?(?:script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_URLS = /\s+(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi
const DATA_URLS = /\s+(href|src)\s*=\s*(["']?)\s*data:text\/html[^"'\s>]*\2/gi

export function sanitizeRichText(html: string): string {
  return html
    .replace(BLOCKED_TAGS, '')
    .replace(EVENT_ATTRS, '')
    .replace(JS_URLS, ' $1="#"')
    .replace(DATA_URLS, ' $1="#"')
}
