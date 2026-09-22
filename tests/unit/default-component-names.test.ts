/**
 * No two framework components answer to the same tag.
 *
 * stx resolves a component tag by walking each components directory in the
 * order the filesystem lists it, and takes the first file whose name
 * matches. An app's own component shadows the framework's of the same name
 * on purpose (production-server.ts puts the app's directory first). Among the
 * framework's own components there is no such order: a name used twice gave
 * whichever folder the disk listed first. `Marketing/Header.stx` and
 * `Storefront/Header.stx` both answered `<Header>`, and `Footer` likewise.
 * APFS listed Storefront first, so every local run rendered the storefront's
 * header. ext4 orders a directory by a hash seeded per filesystem, so the
 * production storefront rendered the marketing header and footer, with no
 * cart badge, and so did 4 of 7 CI runs of
 * storage/framework/core/buddy/tests/request-context-concurrency.test.ts.
 *
 * stx looks in the directory itself before it walks the folders below, so
 * a component there wins over any of the same name further down, whatever
 * the order: `Pagination.stx` over `Dashboard/UI/Pagination.stx`. Only a
 * name shared below the top is settled by the order the disk lists folders.
 * stx tries a tag as written, in PascalCase and in kebab-case, and a
 * case-insensitive disk matches any case, so names are compared without
 * case or hyphens.
 */
import { describe, expect, it } from 'bun:test'
import { Glob } from 'bun'
import { join, resolve } from 'node:path'

const components = resolve(import.meta.dir, '../../storage/framework/defaults/resources/components')

describe('framework components', () => {
  it('each answer to a tag no other in a subfolder answers to', () => {
    const byTag = new Map<string, string[]>()
    for (const file of new Glob('**/*.stx').scanSync({ cwd: components })) {
      const name = file.split('/').pop()!.slice(0, -'.stx'.length)
      const tag = name.toLowerCase().replaceAll('-', '')
      byTag.set(tag, [...(byTag.get(tag) ?? []), file])
    }
    // A sanity floor: the walk found the tree, not an empty directory.
    expect(byTag.size).toBeGreaterThan(50)
    const settledByOrder = [...byTag.values()]
      .filter(files => files.length > 1 && !files.some(file => !file.includes('/')))
      .map(files => files.sort().join(' and '))
    expect(settledByOrder).toEqual([])
  })

  it('leave the storefront layout its own header and footer', async () => {
    // The tags the storefront layout renders, and the one file each resolves to.
    const layout = await Bun.file(resolve(components, '../layouts/storefront.stx')).text()
    for (const [tag, file] of [['Header', 'Storefront/Header.stx'], ['Footer', 'Storefront/Footer.stx']]) {
      expect(layout).toContain(`<${tag}`)
      const matches = [...new Glob(`**/${tag}.stx`).scanSync({ cwd: components })]
      expect(matches).toEqual([file])
      expect(await Bun.file(join(components, file)).exists()).toBe(true)
    }
  })
})
