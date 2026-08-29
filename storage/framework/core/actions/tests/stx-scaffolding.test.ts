import { describe, expect, it } from 'bun:test'
import { componentFileName, pageFileName } from '../src/make'
import { resolveLibraryPackages } from '../src/library/packages'
import { CODE_TEMPLATES } from '../src/templates'

describe('STX scaffolding', () => {
  it('scaffolds components and pages with the STX extension', () => {
    expect(componentFileName('ProfileCard')).toBe('ProfileCard.stx')
    expect(pageFileName('settings')).toBe('settings.stx')
  })

  it('resolves STX components into a web-component package', async () => {
    // Custom elements are no longer produced by a hand-written entry file:
    // `buildComponentLibrary` compiles the .stx sources and each generated
    // module registers its own tag. What the config layer still owns is which
    // components a given package claims.
    const [pkg] = await resolveLibraryPackages({
      packages: [{ name: 'scaffolding-elements', kind: 'web-components', include: ['*.stx'] }],
    })

    expect(pkg?.kind).toBe('web-components')
    expect(pkg?.sources.every(source => source.endsWith('.stx'))).toBe(true)
  })

  it('uses STX scripts in component and page templates', () => {
    expect(CODE_TEMPLATES.component).toContain('<script server>')
    expect(CODE_TEMPLATES.page).toContain('<script server>')
    expect(CODE_TEMPLATES.component).not.toContain('<script setup')
    expect(CODE_TEMPLATES.page).not.toContain('<script setup')
  })

  it('scaffolds one uniquely named auto-importable function', () => {
    expect(CODE_TEMPLATES.function).toContain('export function {0}(): void')
    expect(CODE_TEMPLATES.function).not.toContain('ref(')
    expect(CODE_TEMPLATES.function).not.toContain('.value')
    expect(CODE_TEMPLATES.function).not.toContain('function increment')
  })
})
