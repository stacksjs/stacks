import { describe, expect, it } from 'bun:test'
import { determineResetPreset } from '../src/helpers'

describe('determineResetPreset', () => {
  it('returns tailwind reset import', () => {
    const imports = determineResetPreset('tailwind')
    expect(imports).toEqual(['import { tailwindPreflight as reset } from "@cwcss/crosswind"'])
  })

  it('returns forms reset import', () => {
    const imports = determineResetPreset('forms')
    expect(imports).toEqual(['import { tailwindFormsPreflight as reset } from "@cwcss/crosswind"'])
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
