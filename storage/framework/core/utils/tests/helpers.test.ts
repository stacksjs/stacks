import { describe, expect, it } from 'bun:test'
import { determineResetPreset } from '../src/helpers'

describe('determineResetPreset', () => {
  it('returns tailwind reset import', () => {
    const imports = determineResetPreset('tailwind')
    expect(imports).toEqual(['import "@unocss/reset/tailwind.css"'])
  })

  it('returns normalize reset import', () => {
    const imports = determineResetPreset('normalize')
    expect(imports).toEqual(['import "@unocss/reset/normalize.css"'])
  })

  it('returns empty array for null preset', () => {
    const imports = determineResetPreset(null)
    expect(imports).toEqual([])
  })

  it('returns empty array for unknown preset', () => {
    const imports = determineResetPreset('unknown-preset')
    expect(imports).toEqual([])
  })
})
