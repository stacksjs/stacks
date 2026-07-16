import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// blog-admin resolves content/blog from process.cwd() at module load, so the
// cwd has to move to a throwaway dir BEFORE the import. Otherwise these tests
// would create and delete files in the real content/blog.
const root = mkdtempSync(join(tmpdir(), 'stacks-blog-admin-'))
const contentDir = join(root, 'content/blog')
mkdirSync(contentDir, { recursive: true })

const originalCwd = process.cwd()
process.chdir(root)

const { deleteBlogPost, getBlogPost, listBlogPosts, saveBlogPost, slugify } = await import('../storage/framework/core/actions/src/blog-admin')

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

describe('slugify', () => {
  it('produces a filename-safe slug', () => {
    expect(slugify('The Road to v1.0!')).toBe('the-road-to-v1-0')
    expect(slugify('  Hello   World  ')).toBe('hello-world')
  })
})

describe('listBlogPosts', () => {
  it('reads posts from disk, drafts included', () => {
    write('one.md', '---\ntitle: One\ndate: 2026-01-01\n---\n\nBody one.\n')
    write('two.md', '---\ntitle: Two\ndate: 2026-02-01\ndraft: true\n---\n\nBody two.\n')

    const posts = listBlogPosts()

    expect(posts.map(p => p.slug)).toEqual(['two', 'one'])
    expect(posts.find(p => p.slug === 'two')?.draft).toBe(true)
    expect(posts.find(p => p.slug === 'one')?.draft).toBe(false)
  })

  it('sorts featured first, then newest', () => {
    write('old-featured.md', '---\ntitle: Old featured\ndate: 2020-01-01\nfeatured: true\n---\n\nx\n')
    write('new.md', '---\ntitle: New\ndate: 2026-06-01\n---\n\nx\n')

    expect(listBlogPosts().map(p => p.slug)).toEqual(['old-featured', 'new'])
  })

  it('skips prose docs that have no title', () => {
    write('STRATEGY.md', '# Just a doc\n\nNo frontmatter here.\n')
    write('real.md', '---\ntitle: Real\ndate: 2026-01-01\n---\n\nx\n')

    expect(listBlogPosts().map(p => p.slug)).toEqual(['real'])
  })
})

describe('saveBlogPost', () => {
  it('writes a file BunPress can parse back', () => {
    const post = saveBlogPost({ title: 'Hello World', description: 'A summary.', date: '2026-03-04', author: 'Chris', body: '# Hi\n\nSome text.' })

    expect(post.slug).toBe('hello-world')
    expect(existsSync(join(contentDir, 'hello-world.md'))).toBe(true)

    const raw = readFileSync(join(contentDir, 'hello-world.md'), 'utf-8')
    expect(raw.startsWith('---\ntitle: Hello World\n')).toBe(true)
    expect(raw).toContain('date: 2026-03-04')
    expect(raw).toContain('# Hi')

    // Round-trips through the reader with every field intact.
    const read = getBlogPost('hello-world')
    expect(read?.title).toBe('Hello World')
    expect(read?.description).toBe('A summary.')
    expect(read?.body).toBe('# Hi\n\nSome text.')
  })

  it('defaults the date to today when omitted', () => {
    const post = saveBlogPost({ title: 'No date', body: 'x' })

    expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('only writes boolean keys when true, so published posts stay clean', () => {
    saveBlogPost({ title: 'Plain', date: '2026-01-01', body: 'x' })
    const raw = readFileSync(join(contentDir, 'plain.md'), 'utf-8')

    expect(raw).not.toContain('draft:')
    expect(raw).not.toContain('featured:')
  })

  it('refuses to overwrite an existing post on create', () => {
    saveBlogPost({ title: 'Dupe', date: '2026-01-01', body: 'original' })

    expect(() => saveBlogPost({ title: 'Dupe', date: '2026-01-01', body: 'clobber' })).toThrow(/already exists/)
    expect(getBlogPost('dupe')?.body).toBe('original')
  })

  it('updates in place without renaming', () => {
    saveBlogPost({ title: 'Post', date: '2026-01-01', body: 'v1' })
    saveBlogPost({ slug: 'post', originalSlug: 'post', title: 'Post', date: '2026-01-01', body: 'v2' })

    expect(getBlogPost('post')?.body).toBe('v2')
  })

  it('renames the file when the slug changes', () => {
    saveBlogPost({ title: 'Old Name', date: '2026-01-01', body: 'body' })
    saveBlogPost({ slug: 'new-name', originalSlug: 'old-name', title: 'New Name', date: '2026-01-01', body: 'body' })

    expect(existsSync(join(contentDir, 'old-name.md'))).toBe(false)
    expect(getBlogPost('new-name')?.title).toBe('New Name')
  })

  it('refuses a rename that would clobber another post', () => {
    saveBlogPost({ title: 'First', date: '2026-01-01', body: 'first body' })
    saveBlogPost({ title: 'Second', date: '2026-01-02', body: 'second body' })

    expect(() => saveBlogPost({ slug: 'first', originalSlug: 'second', title: 'Second', date: '2026-01-02', body: 'x' })).toThrow(/already exists/)
    expect(getBlogPost('first')?.body).toBe('first body')
    expect(getBlogPost('second')?.body).toBe('second body')
  })

  it('rejects a title-only post with no title', () => {
    expect(() => saveBlogPost({ title: '   ', body: 'x' })).toThrow(/title is required/)
  })

  it('rejects a malformed date', () => {
    expect(() => saveBlogPost({ title: 'Bad date', date: '04/03/2026', body: 'x' })).toThrow(/YYYY-MM-DD/)
  })

  it('rejects values that would corrupt the single-line frontmatter', () => {
    expect(() => saveBlogPost({ title: 'Multi\nline', body: 'x' })).toThrow(/line breaks/)
  })

  it('quotes values that would otherwise re-parse as something else', () => {
    saveBlogPost({ title: 'Quoted', date: '2026-01-01', description: 'A title: with a colon', body: 'x' })

    // The reader must give back exactly what went in.
    expect(getBlogPost('quoted')?.description).toBe('A title: with a colon')
  })

  it('refuses path traversal in a slug', () => {
    expect(() => saveBlogPost({ slug: '../../evil', title: 'Evil', body: 'x' })).toThrow(/Invalid slug/)
    expect(() => saveBlogPost({ slug: 'nested/path', title: 'Nested', body: 'x' })).toThrow(/Invalid slug/)
    expect(() => saveBlogPost({ slug: '.hidden', title: 'Hidden', body: 'x' })).toThrow(/Invalid slug/)

    // Nothing escaped the content dir.
    expect(existsSync(join(root, 'evil.md'))).toBe(false)
    expect(existsSync(join(root, 'content/evil.md'))).toBe(false)
  })
})

describe('deleteBlogPost', () => {
  it('deletes a post and reports whether it existed', () => {
    saveBlogPost({ title: 'Doomed', date: '2026-01-01', body: 'x' })

    expect(deleteBlogPost('doomed')).toBe(true)
    expect(existsSync(join(contentDir, 'doomed.md'))).toBe(false)
    expect(deleteBlogPost('doomed')).toBe(false)
  })

  it('refuses path traversal', () => {
    writeFileSync(join(root, 'secret.md'), 'secret', 'utf-8')

    expect(() => deleteBlogPost('../../secret')).toThrow(/Invalid slug/)
    expect(existsSync(join(root, 'secret.md'))).toBe(true)
  })
})
