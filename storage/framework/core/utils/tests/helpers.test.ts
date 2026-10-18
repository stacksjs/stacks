import { describe, expect, it } from 'bun:test'
import { determineResetPreset } from '../src/helpers'

describe('determineResetPreset', () => {
  it('returns tailwind reset import', () => {
    const imports = determineResetPreset('tailwind')
    expect(imports).toEqual(['import { tailwindPreflight as reset } from "@stacksjs/ts-css/engine"'])
  })

  it('returns forms reset import', () => {
    const imports = determineResetPreset('forms')
    expect(imports).toEqual(['import { tailwindFormsPreflight as reset } from "@stacksjs/ts-css/engine"'])
  })

  it('generates reset imports that resolve to published engine exports', async () => {
    for (const preset of ['tailwind', 'preflight', 'forms']) {
      const [statement] = determineResetPreset(preset)
      const match = /^import \{ (\w+) as reset \} from "([^"]+)"$/.exec(statement!)
      expect(match).not.toBeNull()
      const engine = await import(match![2]!)
      const reset = engine[match![1]!]
      expect(typeof reset?.getCSS).toBe('function')
      expect(reset.getCSS().length).toBeGreaterThan(0)
    }
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
