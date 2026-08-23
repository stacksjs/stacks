/**
 * A very small TypeScript highlighter for the marketing code panels.
 *
 * The home page hand-wrote its `<span class="tok-*">` tags directly into the
 * template, which is fine for exactly one snippet and unmaintainable for
 * nine: the code stops being readable in the source, and an edit means
 * re-balancing tags by hand. The feature data holds plain code; this turns it
 * into the same markup at render time, against the same `.tok-*` classes the
 * stylesheet already defines.
 *
 * It is a lexer for display, not a parser. It does not know scope and does
 * not need to. What it must not do is mangle the input, so it escapes first
 * and matches comments and strings before anything else, which is what stops
 * a keyword inside a string from being coloured as code.
 */

/** Escape only what can open a tag. Quotes stay literal so strings still match. */
function escapeHtml(code: string): string {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const KEYWORDS = [
  'import', 'export', 'default', 'from', 'as', 'const', 'let', 'var', 'return',
  'async', 'await', 'function', 'new', 'if', 'else', 'for', 'of', 'in', 'class',
  'interface', 'type', 'extends', 'implements', 'throw', 'try', 'catch', 'typeof',
]

/**
 * One pass, alternation ordered by precedence: a `//` inside a string is not a
 * comment, and a keyword inside either is not a keyword, so both win first.
 */
const TOKEN = new RegExp([
  '(\\/\\/[^\\n]*)', // comment
  '(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*"|`(?:[^`\\\\]|\\\\.)*`)', // string
  `\\b(${KEYWORDS.join('|')})\\b`,
  '\\b(true|false|null|undefined)\\b',
  '\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()', // call
  '\\b([A-Za-z_$][\\w$]*)(?=\\s*:)', // object key
].join('|'), 'g')

export function highlight(code: string): string {
  return escapeHtml(code).replace(
    TOKEN,
    (match, comment, string, keyword, literal, call, prop) => {
      if (comment)
        return `<span class="tok-com">${comment}</span>`
      if (string)
        return `<span class="tok-str">${string}</span>`
      if (keyword)
        return `<span class="tok-key">${keyword}</span>`
      if (literal)
        return `<span class="tok-bool">${literal}</span>`
      if (call)
        return `<span class="tok-fn">${call}</span>`
      if (prop)
        return `<span class="tok-prop">${prop}</span>`
      return match
    },
  )
}
