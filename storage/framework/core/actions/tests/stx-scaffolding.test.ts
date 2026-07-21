import { describe, expect, it } from 'bun:test'
import { componentFileName, pageFileName } from '../src/make'
import { generateEntryPointData } from '../src/helpers/lib-entries'

describe('STX scaffolding', () => {
  it('scaffolds components and pages with the STX extension', () => {
    expect(componentFileName('ProfileCard')).toBe('ProfileCard.stx')
    expect(pageFileName('settings')).toBe('settings.stx')
  })

  it('builds custom-element entry points from STX components', () => {
    const entry = generateEntryPointData('web-components')

    expect(entry).toContain("from '@stacksjs/stx'")
    expect(entry).toContain('.stx')
  })
})
