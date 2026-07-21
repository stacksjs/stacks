import { describe, expect, it } from 'bun:test'
import { generateWebTypesData } from '../src/helpers/vscode-custom-data'

describe('STX web types', () => {
  it('generates STX component sources without legacy template paths', () => {
    const data = generateWebTypesData()
    const parsed = JSON.parse(data)

    expect(parsed.framework).toBe('stx')
    expect(parsed.contributions.html.tags.every((tag: { source: { module: string } }) => tag.source.module.endsWith('.stx'))).toBe(true)
  })
})
