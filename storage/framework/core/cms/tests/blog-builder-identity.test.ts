import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The blog builders run for every app, so they name only the app.
 *
 * Both used to carry stacksjs.com's identity as their defaults. The static CMS
 * build (run by every `buddy deploy`) posted its newsletter form to
 * stacksjs.com's subscribe endpoint, linked stacksjs.com/docs from the nav,
 * wrote feed and sitemap URLs under `blog.stacksjs.com`, and published two
 * built-in posts announcing Stacks on any app whose database had none. The
 * markdown builder fell back to "The Stacks Blog" at https://stacksjs.com for
 * any key an app's config/blog.ts left out.
 *
 * The one mention left on purpose is the footer's "Built with Stacks" credit.
 */

const core = join(import.meta.dir, '../..')
const cms = readFileSync(join(core, 'cms/src/build.ts'), 'utf8')
const markdown = readFileSync(join(core, 'actions/src/blog.ts'), 'utf8')

/** Source with comments and the footer credit removed. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace('Built with <a href="https://stacksjs.com">Stacks</a>', '')
}

describe('blog builders carry no stacksjs.com identity', () => {
  it('the CMS build', () => {
    expect(code(cms)).not.toContain('stacksjs.com')
    expect(code(cms)).not.toContain('Stacks Team')
    expect(cms).toContain('action="/api/email/subscribe"')
  })

  it('the CMS build publishes no built-in posts', () => {
    expect(cms).not.toContain('getDefaultBlogPosts')
    expect(cms).not.toContain('Introducing Stacks')
  })

  it('the markdown build', () => {
    expect(code(markdown)).not.toContain('https://stacksjs.com\'')
    expect(code(markdown)).not.toContain('The Stacks Blog')
    expect(markdown).toContain('process.env.APP_NAME')
  })
})
