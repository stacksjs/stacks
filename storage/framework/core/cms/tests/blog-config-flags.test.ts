import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * A blog config flag either does something or says it does not.
 *
 * `enableComments` and `enableSearch` are declared in `BlogConfig`, default to
 * `true`, and nothing reads them - the generated pages carry no comment
 * section and no search index either way. Two agent skills documented them
 * beside `enableRss` and `enableSitemap`, which are honoured, so there was no
 * way to tell the two pairs apart.
 *
 * This fails if one gains an implementation without losing its warning, or
 * loses an implementation without gaining one.
 */

const repoRoot = dirname(dirname(dirname(dirname(dirname(import.meta.dir)))))
const builder = readFileSync(join(repoRoot, 'storage/framework/core/cms/src/build.ts'), 'utf8')
const config = readFileSync(join(repoRoot, 'config/blog.ts'), 'utf8')

/** Whether the builder branches on this flag at all. */
function honoured(flag: string): boolean {
  return new RegExp(`config\\.${flag}\\b`).test(builder)
}

describe('blog config flags', () => {
  it('honours enableRss and enableSitemap', () => {
    expect(honoured('enableRss')).toBeTrue()
    expect(honoured('enableSitemap')).toBeTrue()
  })

  for (const flag of ['enableComments', 'enableSearch']) {
    it(`says plainly that ${flag} is not honoured, for as long as it is not`, () => {
      if (honoured(flag)) {
        // Implemented since this was written: drop the warning rather than
        // leaving the config lying in the other direction.
        expect(config).not.toContain(`NOT YET HONOURED`)
        return
      }

      // The declaration must carry the warning, or a reader has no way to tell
      // it apart from the two above.
      const declaration = config.slice(0, config.indexOf(`${flag}: boolean`))
      expect(declaration.slice(-400)).toContain('NOT YET HONOURED')
    })
  }
})
