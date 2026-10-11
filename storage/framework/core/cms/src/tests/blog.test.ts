/**
 * Markdown blog posts (`@stacksjs/cms/blog`): which files in content/blog are
 * published, in what order, how a body renders, and who the byline names.
 */
import type { AuthorProfile } from '../blog'
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { authorsOf, bylineOf, createAuthorResolver, formatPostDate, initialsOf, isPostSlug, isPublished, joinNames, loadPost, loadPosts, parseFrontmatter, readingMinutes, renderPostBody, sortPosts } from '../blog'

const dir = mkdtempSync(join(tmpdir(), 'stacks-blog-'))

function post(slug: string, frontmatter: string, body = 'Some words in a post body.'): void {
  writeFileSync(join(dir, `${slug}.md`), `---\n${frontmatter}\n---\n\n${body}\n`)
}

post('older', 'title: Older\ndate: 2026-01-02\ndescription: The first one.')
post('newer', 'title: "Newer: with a colon"\ndate: 2026-03-04\nauthor: Ada Lovelace\nmood: sunny')
post('pinned', 'title: Pinned\ndate: 2025-12-01\nfeatured: true')
post('hidden', 'title: Hidden\ndate: 2026-05-01\ndraft: true')
post('STRATEGY', 'date: 2026-05-01')
writeFileSync(join(dir, 'notes.txt'), 'not a post')
writeFileSync(join(dir, 'with.dot.md'), '---\ntitle: Dotted\ndate: 2026-05-01\n---\n')
mkdirSync(join(dir, 'images'))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('frontmatter', () => {
  it('reads key: value lines, quoted or not, and keeps colons inside a value', () => {
    const { data, body } = parseFrontmatter('---\ntitle: "A: b"\ndate: 2026-10-11\n---\n\nHello')
    expect(data).toEqual({ title: 'A: b', date: '2026-10-11' })
    expect(body.trim()).toBe('Hello')
  })

  it('reads CRLF files', () => {
    expect(parseFrontmatter('---\r\ntitle: A\r\n---\r\nBody').data).toEqual({ title: 'A' })
  })

  it('leaves a file without frontmatter as all body', () => {
    expect(parseFrontmatter('# Just markdown')).toEqual({ data: {}, body: '# Just markdown' })
  })

  it('publishes a title with a date that is not a draft', () => {
    expect(isPublished({ title: 'A', date: '2026-01-01' })).toBe(true)
    expect(isPublished({ title: 'A', date: '2026-01-01', draft: 'true' })).toBe(false)
    expect(isPublished({ date: '2026-01-01' })).toBe(false)
  })
})

describe('loadPosts', () => {
  it('lists published posts only: featured first, then newest first', () => {
    expect(loadPosts({ dir }).map(p => p.slug)).toEqual(['pinned', 'newer', 'older'])
  })

  it('carries what a listing shows, the raw frontmatter, and no body', () => {
    const newer = loadPosts({ dir }).find(p => p.slug === 'newer')!
    expect(newer.title).toBe('Newer: with a colon')
    expect(newer.author).toBe('Ada Lovelace')
    expect(newer.frontmatter.mood).toBe('sunny')
    expect(newer.minutes).toBe(1)
    expect('body' in newer).toBe(false)
  })

  it('is empty when the folder does not exist', () => {
    expect(loadPosts({ dir: join(dir, 'missing') })).toEqual([])
  })

  it('sorts by date when nothing is featured', () => {
    expect(sortPosts([{ date: '2026-01-01', featured: false }, { date: '2026-02-01', featured: false }]).map(p => p.date)).toEqual(['2026-02-01', '2026-01-01'])
  })
})

describe('loadPost', () => {
  it('finds a published post with its body', () => {
    expect(loadPost('older', { dir })?.body.trim()).toBe('Some words in a post body.')
  })

  it('answers null for drafts, non-posts, unknown slugs and anything path-like', () => {
    for (const slug of ['hidden', 'STRATEGY', 'nope', '../older', 'older.md', 'with.dot', '', undefined, null])
      expect(loadPost(slug, { dir })).toBeNull()
    expect(isPostSlug('../x')).toBe(false)
    expect(isPostSlug('My_Post-2')).toBe(true)
  })
})

describe('rendering', () => {
  it('counts reading time at 230 words a minute, at least one, without code', () => {
    expect(readingMinutes('word '.repeat(10))).toBe(1)
    expect(readingMinutes('word '.repeat(1150))).toBe(5)
    expect(readingMinutes(`\`\`\`\n${'x '.repeat(2000)}\n\`\`\``)).toBe(1)
  })

  it('formats the date as a calendar day, whatever the server time zone', () => {
    expect(formatPostDate('2026-10-11')).toBe('October 11, 2026')
    expect(formatPostDate('soon')).toBe('soon')
  })

  it('renders markdown to HTML', () => {
    const html = renderPostBody('## Heading\n\nA [link](/features) and `code`.\n\n- one\n- two')
    expect(html).toContain('<h2>Heading</h2>')
    expect(html).toContain('<a href="/features">link</a>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<li>one</li>')
  })
})

describe('authorsOf', () => {
  it('reads `authors` in order, with each one\'s fallbacks', () => {
    expect(authorsOf({
      'authors': '[ada, "grace", ada]',
      'author.ada.name': 'Ada Lovelace',
      'author.grace.bio': 'Admiral.',
    })).toEqual([
      { username: 'ada', name: 'Ada Lovelace', avatar: '', bio: '' },
      { username: 'grace', name: '', avatar: '', bio: 'Admiral.' },
    ])
  })

  it('skips a name that is not a username', () => {
    expect(authorsOf({ authors: '../admin, ada' }).map(a => a.username)).toEqual(['ada'])
  })

  it('reads the single-author keys', () => {
    expect(authorsOf({ author: 'Ada Lovelace', authorUsername: 'Ada', authorAvatar: '/a.jpeg', authorBio: 'Bio.' }))
      .toEqual([{ username: 'ada', name: 'Ada Lovelace', avatar: '/a.jpeg', bio: 'Bio.' }])
    expect(authorsOf({ author: 'Guest Writer' })).toEqual([{ username: '', name: 'Guest Writer', avatar: '', bio: '' }])
    expect(authorsOf({})).toEqual([])
  })
})

describe('createAuthorResolver', () => {
  const ada = { username: 'ada', name: 'Ada Lovelace', avatar: '/a.jpeg', bio: 'Wrote the first program.' }
  const grace = { username: 'grace', name: 'Grace Hopper', avatar: '/g.jpeg', bio: '' }

  it('takes the profile\'s name, picture and link, and keeps the post\'s own bio', async () => {
    const resolve = createAuthorResolver({ lookup: () => ({ name: 'Ada L.', initials: 'AL', avatar: '/live.jpeg', bio: 'Profile bio.', url: '/ada' }) })
    expect(await resolve.one(ada)).toEqual({ name: 'Ada L.', initials: 'AL', avatar: '/live.jpeg', bio: 'Wrote the first program.', url: '/ada' })
  })

  it('falls back to the frontmatter, without a link, when there is no profile or the lookup fails', async () => {
    const fallback = { name: 'Ada Lovelace', initials: 'AL', avatar: '/a.jpeg', bio: 'Wrote the first program.', url: '' }
    expect(await createAuthorResolver({ lookup: () => null }).one(ada)).toEqual(fallback)
    expect(await createAuthorResolver({ lookup: () => { throw new Error('offline') } }).one(ada)).toEqual(fallback)
    expect(await createAuthorResolver().one(ada)).toEqual(fallback)
  })

  it('resolves every author in order, each from their own profile', async () => {
    const asked: string[] = []
    const resolve = createAuthorResolver({
      lookup: async (username): Promise<AuthorProfile | null> => {
        asked.push(username)
        return username === 'grace' ? { name: 'Grace Hopper', bio: 'Admiral.', url: '/grace' } : null
      },
    })
    const authors = await resolve({ authors: [ada, grace] })
    expect(asked).toEqual(['ada', 'grace'])
    expect(authors.map(a => [a.name, a.url, a.bio])).toEqual([
      ['Ada Lovelace', '', 'Wrote the first program.'],
      ['Grace Hopper', '/grace', 'Admiral.'],
    ])
  })

  it('names the fallback when a post names nobody', async () => {
    expect((await createAuthorResolver({ fallbackName: 'The team' })({ authors: [] })).map(a => a.name)).toEqual(['The team'])
  })

  it('asks for a profile once within the TTL, and again after clear()', async () => {
    let calls = 0
    const resolve = createAuthorResolver({ lookup: () => {
      calls++
      return null
    } })
    await resolve.one(ada)
    await resolve.one(ada)
    expect(calls).toBe(1)
    resolve.clear()
    await resolve.one(ada)
    expect(calls).toBe(2)
  })

  it('never asks about a username that is not one', async () => {
    let called = false
    const resolve = createAuthorResolver({ lookup: () => {
      called = true
      return null
    } })
    await resolve.one({ ...ada, username: '../admin' })
    expect(called).toBe(false)
  })
})

describe('bylines', () => {
  it('join names', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
    expect(initialsOf('Grace Brewster Hopper')).toBe('GH')
  })

  it('lay out each author with the words before them and their picture style', () => {
    const byline = bylineOf([
      { name: 'A', initials: 'A', avatar: '/a.jpeg', bio: '', url: '' },
      { name: 'B', initials: 'B', avatar: '', bio: '', url: '' },
      { name: 'C', initials: 'C', avatar: '', bio: '', url: '' },
    ])
    expect(byline.map(a => a.joiner)).toEqual(['', ', ', ' and '])
    expect(byline[0]!.avatarStyle).toBe('background-image:url("/a.jpeg")')
    expect(byline[1]!.avatarStyle).toBe('')
  })
})
