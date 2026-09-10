import { describe, expect, it } from 'bun:test'
import { wrapForTarget } from '../src/generate/erd'

describe('wrapForTarget', () => {
  const diagram = 'erDiagram\n  users ||--o{ posts : "has many"'

  it('fences a markdown target so it renders', () => {
    // A .md file holding a bare `erDiagram` renders as a paragraph of broken
    // text, which looks like the generator failed rather than like the wrong
    // extension.
    const output = wrapForTarget(diagram, '/p/docs/erd.md')
    expect(output).toContain('```mermaid')
    expect(output).toContain(diagram)
    expect(output.trimEnd().endsWith('```')).toBeTrue()
  })

  it('says it is generated, so nobody edits it by hand', () => {
    expect(wrapForTarget(diagram, '/p/docs/erd.md')).toContain('Edit your models, not this.')
  })

  it('leaves a .mmd target bare, because a fence is not Mermaid', () => {
    const output = wrapForTarget(diagram, '/p/docs/erd.mmd')
    expect(output).toBe(`${diagram}\n`)
    expect(output).not.toContain('```')
  })

  it('ends with a newline either way', () => {
    for (const target of ['/p/erd.md', '/p/erd.mmd', '/p/erd.txt'])
      expect(wrapForTarget(diagram, target).endsWith('\n')).toBeTrue()
  })
})
