import type { SearchDocument, SearchResult } from './search'

/** Split private text before persistence, without a provider request or hidden truncation. */
export function chunkDocument(document: SearchDocument, options: { size?: number, overlap?: number } = {}): SearchDocument[] {
  const { size = 1600, overlap = 160 } = options
  if (!Number.isSafeInteger(size) || size < 64 || !Number.isSafeInteger(overlap) || overlap < 0 || overlap >= size)
    throw new TypeError('Document size must be at least 64 and overlap must be smaller than size')
  const chunks: SearchDocument[] = []
  for (let start = 0; start < document.content.length;) {
    let end = Math.min(start + size, document.content.length)
    if (end < document.content.length) {
      const boundary = document.content.lastIndexOf(' ', end)
      if (boundary > start + size / 2) end = boundary
      // Never cut a Unicode surrogate pair in half.
      const code = document.content.charCodeAt(end - 1)
      if (code >= 0xD800 && code <= 0xDBFF) end--
    }
    const content = document.content.slice(start, end).trim()
    if (content) chunks.push({ id: `${document.id}:${chunks.length}`, content, metadata: { ...document.metadata, sourceId: document.id, start, end } })
    if (end === document.content.length) break
    start = Math.max(start + 1, end - overlap)
    const code = document.content.charCodeAt(start)
    if (code >= 0xDC00 && code <= 0xDFFF) start++
  }
  return chunks
}

function tokens(text: string): string[] {
  return text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

/** BM25 retrieval over an already authorized corpus. Callers own tenant filtering. */
export function searchDocuments(query: string, documents: SearchDocument[], options: { topK?: number, maxCharacters?: number } = {}): SearchResult[] {
  const { topK = 5, maxCharacters = 12000 } = options
  if (!Number.isSafeInteger(topK) || topK < 1 || !Number.isSafeInteger(maxCharacters) || maxCharacters < 1)
    throw new TypeError('Retrieval limits must be positive integers')
  if (!documents.length) return []
  const terms = [...new Set(tokens(query))].slice(0, 128)
  if (!terms.length) return []
  const corpus = documents.map(document => {
    const words = tokens(document.content)
    const frequencies = new Map<string, number>()
    for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
    return { document, length: words.length, frequencies }
  })
  const average = corpus.reduce((sum, entry) => sum + entry.length, 0) / corpus.length || 1
  const counts = new Map(terms.map(term => [term, corpus.filter(entry => entry.frequencies.has(term)).length]))
  const scored = corpus.map(entry => {
    let score = 0
    for (const term of terms) {
      const frequency = entry.frequencies.get(term) ?? 0
      if (!frequency) continue
      const count = counts.get(term)!
      const inverse = Math.log(1 + (corpus.length - count + 0.5) / (count + 0.5))
      score += inverse * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * entry.length / average))
    }
    return { document: entry.document, score }
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id))
  const results: SearchResult[] = []
  let remaining = maxCharacters
  for (const entry of scored) {
    if (entry.document.content.length > remaining) continue
    results.push({ ...entry, rank: results.length + 1 })
    remaining -= entry.document.content.length
    if (results.length === topK) break
  }
  return results
}
