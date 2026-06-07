import { createHighlighter, detectLanguageFromExtension, getLanguageByExtension } from 'ts-syntax-highlighter'
import type { Highlighter } from 'ts-syntax-highlighter'

let sharedHighlighter: Highlighter | null = null
let sharedCss: string | null = null

async function getHighlighter(): Promise<Highlighter> {
  if (!sharedHighlighter) {
    sharedHighlighter = await createHighlighter({
      theme: 'github-light',
      cache: true,
    })
  }
  return sharedHighlighter
}

export function languageForFile(file: string): string {
  const ext = file.includes('.') ? `.${file.split('.').pop()}` : file
  const byExt = detectLanguageFromExtension(file) ?? getLanguageByExtension(ext)
  if (byExt) return byExt.id
  if (ext === '.php') return 'php'
  if (ext === '.sql') return 'sql'
  return 'text'
}

export async function highlightSnippet(
  code: string,
  file: string,
  highlightLine: number,
  startingLine: number,
): Promise<{ html: string, css: string }> {
  const highlighter = await getHighlighter()
  const lang = languageForFile(file)
  const relativeHighlight = Math.max(1, highlightLine - startingLine + 1)

  const result = await highlighter.highlight(code, lang, {
    lineNumbers: true,
    highlightLines: [relativeHighlight],
  })

  if (result.css && !sharedCss) {
    sharedCss = result.css
  }

  return {
    html: result.html,
    css: sharedCss ?? result.css ?? '',
  }
}

export function getSharedHighlighterCss(): string {
  return sharedCss ?? ''
}

export function resetHighlighterCache(): void {
  sharedHighlighter = null
  sharedCss = null
}
