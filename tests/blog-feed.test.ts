import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// blog.ts resolves content/blog from process.cwd() at module load, so the cwd
// has to move to a throwaway dir BEFORE the import.
const root = mkdtempSync(join(tmpdir(), 'stacks-blog-feed-'))
const contentDir = join(root, 'content/blog')
mkdirSync(contentDir, { recursive: true })

const originalCwd = process.cwd()
process.chdir(root)

// `renderBlogFeed` builds the feed + sitemap straight from frontmatter with no
// BunPress dependency, which makes it the honest test target for what the public
// SEO surfaces expose. `buildBlog` covers the same generators but hard-requires
// BunPress on disk.
const { renderBlogFeed } = await import('../storage/framework/core/actions/src/blog')

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(root, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(contentDir, { recursive: true, force: true })
  mkdirSync(contentDir, { recursive: true })
})

function write(name: string, contents: string) {
  writeFileSync(join(contentDir, name), contents, 'utf-8')
}

function publishedPost() {
  write('shipped.md', '---\ntitle: Shipped Post\ndescription: A real one.\ndate: 2026-01-01\n---\n\nBody.\n')
}

function draftPost() {
  write('unfinished.md', '---\ntitle: Unfinished Post\ndescription: Not for the world yet.\ndate: 2026-02-01\ndraft: true\n---\n\nSecret plans.\n')
}

async function feed(): Promise<string> {
  const res = await renderBlogFeed(new Request('https://stacksjs.com/blog/feed.xml'))
  return await res!.text()
}

async function sitemap(): Promise<string> {
  const res = await renderBlogFeed(new Request('https://stacksjs.com/blog/sitemap.xml'))
  return await res!.text()
}

describe('rss feed', () => {
  it('includes published posts', async () => {
    publishedPost()
    const xml = await feed()

    expect(xml).toContain('Shipped Post')
    expect(xml).toContain('/blog/shipped')
  })

  // Regression: BunPress's own buildRssFeed scanned content/blog itself and had
  // no concept of `draft`, so an unpublished post's title, description, and URL
  // were syndicated even though the listing hid it and its page 404'd.
  it('never syndicates a draft', async () => {
    publishedPost()
    draftPost()
    const xml = await feed()

    expect(xml).toContain('Shipped Post')
    expect(xml).not.toContain('Unfinished Post')
    expect(xml).not.toContain('Not for the world yet.')
    expect(xml).not.toContain('/blog/unfinished')
  })
})

describe('sitemap', () => {
  it('includes published posts', async () => {
    publishedPost()

    expect(await sitemap()).toContain('/blog/shipped')
  })

  it('never lists a draft', async () => {
    publishedPost()
    draftPost()
    const xml = await sitemap()

    expect(xml).toContain('/blog/shipped')
    expect(xml).not.toContain('/blog/unfinished')
  })
})

describe('renderBlogFeed', () => {
  it('ignores non-feed paths', async () => {
    expect(await renderBlogFeed(new Request('https://stacksjs.com/blog'))).toBeNull()
    expect(await renderBlogFeed(new Request('https://stacksjs.com/blog/shipped'))).toBeNull()
  })

  it('ignores unsafe methods', async () => {
    expect(await renderBlogFeed(new Request('https://stacksjs.com/blog/feed.xml', { method: 'POST' }))).toBeNull()
  })
})
