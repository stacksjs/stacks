/**
 * Writing Markdown in a form field (`dashboard.fields.<name>.input:
 * 'markdown'`): what each toolbar button does to the text, and the preview.
 *
 * The buttons are plain text edits, so they are functions of the text and
 * the selection and nothing else: the editor applies what they answer.
 */
import { dashboardApi } from './dashboard-api'

export type MarkdownMark = 'bold' | 'italic' | 'code' | 'link' | 'heading' | 'bullets' | 'numbers' | 'quote'

/** The toolbar, in order: what each button is called and its icon. */
export const MARKDOWN_MARKS: ReadonlyArray<{ mark: MarkdownMark, label: string, icon: string }> = [
  { mark: 'bold', label: 'Bold', icon: 'i-hugeicons-text-bold' },
  { mark: 'italic', label: 'Italic', icon: 'i-hugeicons-text-italic' },
  { mark: 'heading', label: 'Heading', icon: 'i-hugeicons-heading' },
  { mark: 'link', label: 'Link', icon: 'i-hugeicons-link-01' },
  { mark: 'bullets', label: 'Bulleted list', icon: 'i-hugeicons-left-to-right-list-bullet' },
  { mark: 'numbers', label: 'Numbered list', icon: 'i-hugeicons-left-to-right-list-number' },
  { mark: 'quote', label: 'Quote', icon: 'i-hugeicons-quote-down' },
  { mark: 'code', label: 'Code', icon: 'i-hugeicons-source-code' },
]

/** The text after a button was pressed, and what is selected in it. */
export interface MarkdownEdit {
  text: string
  start: number
  end: number
}

/** What a mark that wraps a selection puts on each side of it, and what it wraps when nothing is selected. */
const WRAPS: Partial<Record<MarkdownMark, { around: string, empty: string }>> = {
  bold: { around: '**', empty: 'bold text' },
  italic: { around: '*', empty: 'italic text' },
  code: { around: '`', empty: 'code' },
}

/** What a mark that works on whole lines puts in front of each. */
const PREFIXES: Partial<Record<MarkdownMark, (index: number) => string>> = {
  heading: () => '## ',
  bullets: () => '- ',
  numbers: index => `${index + 1}. `,
  quote: () => '> ',
}

/** Any of the line marks, so one can be swapped for another instead of stacked. */
const ANY_PREFIX = /^(?:#{1,6} |[-*] |\d+\. |> )/

/**
 * Press a toolbar button: `mark` applied to `text`, with `start` to `end`
 * selected.
 *
 * Bold, italic and code wrap the selection, or unwrap it when it is already
 * wrapped; with nothing selected they insert a placeholder, selected, to
 * type over. A link wraps the selection as its words and selects the address
 * to replace. The line marks (heading, lists, quote) go in front of every
 * line the selection touches, and come off again when they are all there.
 */
export function applyMarkdown(mark: MarkdownMark, text: string, start: number, end: number): MarkdownEdit {
  const from = Math.max(0, Math.min(start, end, text.length))
  const to = Math.max(from, Math.min(Math.max(start, end), text.length))
  const selected = text.slice(from, to)

  const wrap = WRAPS[mark]
  if (wrap) {
    const size = wrap.around.length
    // Already wrapped, with the marks inside the selection or just outside it.
    if (selected.length >= size * 2 && selected.startsWith(wrap.around) && selected.endsWith(wrap.around)) {
      const inner = selected.slice(size, -size)
      return { text: text.slice(0, from) + inner + text.slice(to), start: from, end: from + inner.length }
    }
    if (text.slice(from - size, from) === wrap.around && text.slice(to, to + size) === wrap.around)
      return { text: text.slice(0, from - size) + selected + text.slice(to + size), start: from - size, end: to - size }
    const inner = selected || wrap.empty
    return { text: text.slice(0, from) + wrap.around + inner + wrap.around + text.slice(to), start: from + size, end: from + size + inner.length }
  }

  if (mark === 'link') {
    const words = selected || 'link text'
    const address = 'https://'
    const before = `${text.slice(0, from)}[${words}](`
    return { text: `${before}${address})${text.slice(to)}`, start: before.length, end: before.length + address.length }
  }

  const prefix = PREFIXES[mark]
  if (!prefix)
    return { text, start: from, end: to }
  // Every line the selection touches, whole.
  const lineStart = text.lastIndexOf('\n', from - 1) + 1
  const nextBreak = text.indexOf('\n', to)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const lines = text.slice(lineStart, lineEnd).split('\n')
  const marked = lines.every((line, index) => line.startsWith(prefix(index)))
  const changed = lines.map((line, index) => marked ? line.slice(prefix(index).length) : prefix(index) + line.replace(ANY_PREFIX, ''))
  const block = changed.join('\n')
  return { text: text.slice(0, lineStart) + block + text.slice(lineEnd), start: lineStart, end: lineStart + block.length }
}

/** How the Markdown reads, as sanitized HTML from the server. Nothing is stored. */
export async function fetchMarkdownPreview(text: string): Promise<string> {
  const answer = await dashboardApi<{ html?: string }>('/api/dashboard/markdown', { method: 'POST', body: { text } })
  return typeof answer?.html === 'string' ? answer.html : ''
}

/** What the preview's frame may load: nothing but its own styles and images. No script, ever. */
export const MARKDOWN_PREVIEW_POLICY = 'default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\''

/**
 * The document the preview's frame shows: the rendered HTML with enough
 * style to read as prose, in the dashboard's light or dark. The frame is
 * sandboxed and the policy forbids script, so the HTML is inert even if
 * something got past the sanitizer.
 */
export function markdownPreviewDocument(html: string, dark: boolean): string {
  const ink = dark ? '#e5e5e5' : '#171717'
  const soft = dark ? '#a3a3a3' : '#525252'
  const line = dark ? '#404040' : '#e5e5e5'
  const wash = dark ? '#262626' : '#f5f5f5'
  const link = dark ? '#60a5fa' : '#2563eb'
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${MARKDOWN_PREVIEW_POLICY}"><style>
html{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;padding:12px 14px;font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:${ink};background:transparent;overflow-wrap:anywhere}
h1,h2,h3,h4{line-height:1.3;margin:1.2em 0 .5em}h1{font-size:1.5em}h2{font-size:1.25em}h3{font-size:1.1em}
p,ul,ol,blockquote,pre,table{margin:0 0 .9em}ul,ol{padding-left:1.4em}
a{color:${link}}img{max-width:100%;height:auto}
blockquote{padding-left:.9em;border-left:3px solid ${line};color:${soft}}
code{padding:.1em .3em;font:.9em ui-monospace,SFMono-Regular,Menlo,monospace;background:${wash};border-radius:4px}
pre{padding:.7em .9em;overflow-x:auto;background:${wash};border-radius:6px}pre code{padding:0;background:none}
table{border-collapse:collapse}th,td{padding:.3em .6em;border:1px solid ${line}}hr{border:0;border-top:1px solid ${line}}
body>:first-child{margin-top:0}body>:last-child{margin-bottom:0}
</style></head><body>${html}</body></html>`
}
