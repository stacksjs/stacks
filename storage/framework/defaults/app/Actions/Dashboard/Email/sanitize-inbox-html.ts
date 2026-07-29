import type { SanitizerOptions } from '@stacksjs/sanitizer'
import { sanitize } from '@stacksjs/sanitizer'

const inboxHtmlOptions: SanitizerOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'hr',
    'sub',
    'sup',
    'small',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowDataAttributes: false,
  allowAriaAttributes: false,
  allowComments: false,
  stripTags: true,
  transformTag(tagName, attributes) {
    if (tagName !== 'a')
      return { tagName, attributes }

    return {
      tagName,
      attributes: {
        ...attributes,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }
  },
}

export function sanitizeInboxHtml(html: string): string {
  return sanitize(html, inboxHtmlOptions)
}
