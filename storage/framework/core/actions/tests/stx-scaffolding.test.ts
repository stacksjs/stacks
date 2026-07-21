import { describe, expect, it } from 'bun:test'
import { componentFileName, pageFileName } from '../src/make'
import { generateEntryPointData } from '../src/helpers/lib-entries'
import { CODE_TEMPLATES } from '../src/templates'

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

  it('uses STX scripts in component and page templates', () => {
    expect(CODE_TEMPLATES.component).toContain('<script server>')
    expect(CODE_TEMPLATES.page).toContain('<script server>')
    expect(CODE_TEMPLATES.component).not.toContain('<script setup')
    expect(CODE_TEMPLATES.page).not.toContain('<script setup')
  })
})
