import { describe, expect, it } from 'bun:test'
import {
  collectCatalogReferences,
  mergeCatalog,
  readCatalogField,
} from '../src/upgrade/catalog'

describe('vendored upgrade catalog references', () => {
  it('collects every dependency the vendored tree pins to the catalog protocol', () => {
    const references = collectCatalogReferences([
      { dependencies: { 'better-dx': 'catalog:', '@stacksjs/path': '^0.70.163' } },
      { devDependencies: { 'pickier': 'catalog:' }, peerDependencies: { 'better-dx': 'catalog:' } },
      { optionalDependencies: { redis: 'catalog:' } },
    ])

    expect(references).toEqual(['better-dx', 'pickier', 'redis'])
  })

  it('ignores named catalogs, which resolve from a separate map', () => {
    expect(collectCatalogReferences([{ dependencies: { react: 'catalog:react19' } }])).toEqual([])
  })

  it('tolerates manifests without dependency fields', () => {
    expect(collectCatalogReferences([{}, { dependencies: undefined as never }])).toEqual([])
  })

  it('reads a catalog from either shape Bun accepts', () => {
    expect(readCatalogField({ catalog: { 'better-dx': '^0.2.17' } })).toEqual({ 'better-dx': '^0.2.17' })
    expect(readCatalogField({ workspaces: { catalog: { pickier: '^0.1.35' } } })).toEqual({ pickier: '^0.1.35' })
    expect(readCatalogField({ workspaces: ['packages/*'] })).toEqual({})
    expect(readCatalogField(null)).toEqual({})
  })
})

describe('vendored upgrade catalog merge', () => {
  it('adds the entries the vendored tree needs', () => {
    const result = mergeCatalog({}, { 'better-dx': '^0.2.17', 'redis': '^5.12.1' }, ['better-dx'])

    expect(result.catalog).toEqual({ 'better-dx': '^0.2.17' })
    expect(result.added).toEqual(['better-dx'])
    expect(result.updated).toEqual([])
  })

  it('moves an existing pin onto the upstream version', () => {
    const result = mergeCatalog({ 'better-dx': '^0.2.10' }, { 'better-dx': '^0.2.17' }, ['better-dx'])

    expect(result.catalog).toEqual({ 'better-dx': '^0.2.17' })
    expect(result.updated).toEqual(['better-dx'])
    expect(result.added).toEqual([])
  })

  it('leaves catalog entries the app owns untouched', () => {
    const result = mergeCatalog(
      { 'my-own-pkg': '^1.0.0' },
      { 'my-own-pkg': '^9.9.9', 'better-dx': '^0.2.17' },
      ['better-dx'],
    )

    expect(result.catalog['my-own-pkg']).toBe('^1.0.0')
    expect(result.updated).toEqual([])
  })

  it('reports references upstream cannot resolve instead of dropping them', () => {
    const result = mergeCatalog({}, {}, ['ghost-pkg'])

    expect(result.missing).toEqual(['ghost-pkg'])
    expect(result.catalog).toEqual({})
  })

  it('keeps a stale local pin when upstream has no version, so installs still resolve', () => {
    const result = mergeCatalog({ 'better-dx': '^0.2.10' }, {}, ['better-dx'])

    expect(result.catalog).toEqual({ 'better-dx': '^0.2.10' })
    expect(result.missing).toEqual([])
  })

  it('writes a stably sorted catalog so upgrades produce clean diffs', () => {
    const result = mergeCatalog({}, { zod: '^3.0.0', 'better-dx': '^0.2.17' }, ['zod', 'better-dx'])

    expect(Object.keys(result.catalog)).toEqual(['better-dx', 'zod'])
  })
})
