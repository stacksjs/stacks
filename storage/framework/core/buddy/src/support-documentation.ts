import type { HqServicesConfig } from '@stacksjs/types'
import { readFile, realpath, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

export interface SelectedDocument { source: string, title: string, body: string, locale: string, visibility: 'internal' | 'public', publish: boolean }

/** File selection is explicit and confined to the app, including symlink targets. */
export async function selectSupportDocuments(directory: string, selected: readonly string[], options: { locale?: string, public?: boolean, publish?: boolean } = {}): Promise<SelectedDocument[]> {
  if (!selected.length || selected.length > 20) throw new Error('Select between one and twenty Markdown files.')
  const root = await realpath(directory)
  const documents: SelectedDocument[] = [], seen = new Set<string>()
  const locale = options.locale ?? 'en'
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) throw new Error('Select a valid documentation locale.')
  for (const selection of selected) {
    const path = await realpath(resolve(root, selection)), source = relative(root, path).split(sep).join('/')
    if (!source || source.startsWith('../') || !source.toLowerCase().endsWith('.md')) throw new Error('Select Markdown files inside this application.')
    if (seen.has(source)) throw new Error('Select each document once.')
    seen.add(source)
    const metadata = await stat(path)
    if (!metadata.isFile() || metadata.size < 1 || metadata.size > 100000) throw new Error('Each selected document must contain 1 to 100000 bytes.')
    const body = await readFile(path, 'utf8')
    const title = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? source.replace(/\.md$/i, '').split('/').at(-1)!
    if (!title || title.length > 200) throw new Error('Document titles must contain 1 to 200 characters.')
    documents.push({ source, title, body, locale, visibility: options.public ? 'public' : 'internal', publish: options.publish === true })
  }
  return documents
}

export async function runSupportDocsSync(config: HqServicesConfig, documents: readonly SelectedDocument[], options: { dryRun?: boolean }, deps: { fetch: (input: string, init?: RequestInit) => Promise<Response>, print: (line: string) => void }): Promise<boolean> {
  if (options.dryRun) {
    for (const document of documents) deps.print(`${document.source}: ${document.visibility}, ${document.publish ? 'published' : 'draft'}`)
    deps.print(`Preview only: ${documents.length} explicitly selected documents; no data sent.`)
    return true
  }
  const service = config.supporthq
  if (!service?.key || !service.project) { deps.print('Connect HQ.support with buddy support:install first.'); return false }
  try {
    const base = new URL(service.url)
    if (base.username || base.password || base.search || base.hash || base.pathname !== '/' || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Invalid origin')
    const response = await deps.fetch(`${base.origin}/api/v1/projects/${encodeURIComponent(service.project)}/knowledge/sync`, {
      method: 'POST', headers: { Authorization: `Bearer ${service.key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ documents }), redirect: 'error', signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) { deps.print(`HQ.support refused documentation sync (${response.status}). No selected article was overwritten.`); return false }
    const body = await response.json() as { documents?: { source?: unknown, revision?: unknown, changed?: unknown }[] }
    if (!Array.isArray(body.documents) || body.documents.length !== documents.length) throw new Error('Invalid response')
    for (const [index, result] of body.documents.entries()) {
      if (result.source !== documents[index]!.source || typeof result.revision !== 'number' || !Number.isSafeInteger(result.revision) || result.revision < 1 || typeof result.changed !== 'boolean') throw new Error('Invalid response')
      deps.print(`${documents[index]!.source}: revision ${result.revision}, ${result.changed ? 'updated' : 'unchanged'}`)
    }
    return true
  }
  catch {
    deps.print('Documentation sync could not be confirmed. Retry the same selected files; unchanged source is deduplicated.')
    return false
  }
}
