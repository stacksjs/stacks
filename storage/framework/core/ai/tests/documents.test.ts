import { describe, expect, it } from 'bun:test'
import { chunkDocument, searchDocuments } from '../src/documents'

describe('private document retrieval', () => {
  it('retrieves matching German and English knowledge within the context budget', () => {
    const documents = [
      { id: 'recovery', content: 'Erholung nach Wettkampf. Recovery after racing.' },
      { id: 'strength', content: 'Krafttraining mit Kniebeugen. Strength training with squats.' },
    ]
    expect(searchDocuments('Krafttraining', documents).map(result => result.document.id)).toEqual(['strength'])
    expect(searchDocuments('recovery', documents).map(result => result.document.id)).toEqual(['recovery'])
    expect(searchDocuments('nutrition', documents)).toEqual([])
    expect(searchDocuments('training', documents, { maxCharacters: 5 })).toEqual([])
  })

  it('bounds chunks and retains source identity for citations', () => {
    const content = 'Easy running with recovery. '.repeat(100)
    const chunks = chunkDocument({ id: 'coach:7', content, metadata: { version: 2 } }, { size: 100, overlap: 20 })
    expect(chunks.length).toBeGreaterThan(20)
    expect(chunks.every(chunk => chunk.content.length <= 100 && chunk.metadata?.sourceId === 'coach:7' && chunk.metadata.version === 2)).toBe(true)
    expect(chunks.at(-1)?.content.endsWith('recovery.')).toBe(true)
    expect(() => chunkDocument({ id: 'x', content }, { size: 100, overlap: 100 })).toThrow()
  })
})
