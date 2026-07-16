/**
 * Markdown blog admin.
 *
 * The public blog at `/blog` is BunPress + markdown (see `./blog.ts`): posts are
 * files in `content/blog/*.md` and git is the source of truth. This module is the
 * write side of that same store, so the dashboard can create, edit, publish, and
 * delete posts as files rather than as database rows.
 *
 * It deliberately shares the on-disk contract with `blog.ts`:
 *   - a post is `content/blog/<slug>.md`
 *   - frontmatter is single-line `key: value` (what `blog.ts` can parse)
 *   - a post needs `title` + `date` to be addressable
 *
 * `draft: true` keeps a post out of the public listing, feed, and sitemap while
 * leaving the file in place. Posts with no `draft` key are published, so every
 * post written before this module existed keeps rendering.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CONTENT_DIR = join(process.cwd(), 'content/blog')

/** Frontmatter keys we manage, in the order they are written to the file. */
const FIELD_ORDER = ['title', 'description', 'date', 'author', 'authorBio', 'poster', 'featured', 'draft'] as const

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  authorBio: string
  poster: string
  featured: boolean
  draft: boolean
  /** Markdown body, without frontmatter. */
  body: string
  /** Derived, read-only. */
  wordCount: number
  readingTime: number
  updatedAt: string
}

export interface BlogPostInput {
  slug?: string
  /** Set when renaming an existing post's slug; the old file is removed. */
  originalSlug?: string
  title: string
  description?: string
  date?: string
  author?: string
  authorBio?: string
  poster?: string
  featured?: boolean
  draft?: boolean
  body?: string
}

export class BlogAdminError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message)
    this.name = 'BlogAdminError'
  }
}

/**
 * Turn a title into a filename-safe slug.
 *
 * Kept intentionally strict (lowercase a-z, 0-9, single hyphens) because the
 * slug becomes both a filename and a public URL.
 */
export function slugify(input: string): string {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Reject anything that is not a plain slug before it reaches the filesystem.
 *
 * This is the only guard between an API caller and `join(CONTENT_DIR, slug)`, so
 * it refuses separators, traversal, and dotfiles outright rather than sanitising
 * them into something that merely looks safe.
 */
function assertSafeSlug(slug: string): string {
  if (!slug)
    throw new BlogAdminError('A slug is required.')

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new BlogAdminError(`Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens.`)

  return slug
}

/** Minimal single-line `key: value` parser. Mirrors `blog.ts`. */
function parseFrontmatter(md: string): { data: Record<string, string>, body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m)
    return { data: {}, body: md }

  const data: Record<string, string> = {}
  for (const line of (m[1] ?? '').split('\n')) {
    const i = line.indexOf(':')
    if (i === -1)
      continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\'')))
      val = val.slice(1, -1)
    data[key] = val
  }

  return { data, body: m[2] ?? '' }
}

/**
 * Serialise one frontmatter value.
 *
 * The reader is a single-line parser, so a value containing a newline would
 * silently corrupt the file on the next read. Quote anything ambiguous and
 * refuse anything unrepresentable instead of writing a file we cannot parse back.
 */
function serialiseValue(key: string, value: string): string {
  if (/[\r\n]/.test(value))
    throw new BlogAdminError(`"${key}" cannot contain line breaks.`)

  // Quote when the value would otherwise be re-read as something else.
  const needsQuotes = /^["']|["']$|^\s|\s$|:\s/.test(value) || value === ''
  if (!needsQuotes)
    return value

  if (value.includes('"'))
    return `'${value}'`

  return `"${value}"`
}

function toFileContents(post: BlogPost): string {
  const fm: string[] = []

  for (const key of FIELD_ORDER) {
    const raw = post[key]

    if (typeof raw === 'boolean') {
      // Only write the boolean keys when true, since absent already means false
      // to every reader. Saving a post that carried an explicit `featured: false`
      // therefore drops that line: a one-time, semantically neutral diff.
      if (raw)
        fm.push(`${key}: true`)
      continue
    }

    const value = String(raw ?? '')
    if (!value)
      continue

    fm.push(`${key}: ${serialiseValue(key, value)}`)
  }

  const body = post.body.replace(/\s+$/, '')

  return `---\n${fm.join('\n')}\n---\n\n${body}\n`
}

function readingTimeFor(body: string): { wordCount: number, readingTime: number } {
  const wordCount = body.split(/\s+/).filter(Boolean).length
  return { wordCount, readingTime: Math.max(1, Math.round(wordCount / 200)) }
}

function hydrate(slug: string, raw: string, updatedAt: string): BlogPost {
  const { data, body } = parseFrontmatter(raw)
  const { wordCount, readingTime } = readingTimeFor(body)

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.date ?? '',
    author: data.author ?? '',
    authorBio: data.authorBio ?? '',
    poster: data.poster ?? '',
    featured: data.featured === 'true',
    draft: data.draft === 'true',
    // Trimmed at both ends to match what `saveBlogPost` writes, so an unchanged
    // post does not gain a blank line every time it is saved.
    body: body.trim(),
    wordCount,
    readingTime,
    updatedAt,
  }
}

function fileFor(slug: string): string {
  return join(CONTENT_DIR, `${assertSafeSlug(slug)}.md`)
}

/**
 * Every post on disk, newest first, drafts included.
 *
 * Unlike the public `listPosts` in `blog.ts` this does not require a `date`, so
 * a half-finished post still shows up in the dashboard instead of vanishing.
 */
export function listBlogPosts(): BlogPost[] {
  if (!existsSync(CONTENT_DIR))
    return []

  return readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .map((f) => {
      const path = join(CONTENT_DIR, f)
      return hydrate(f.replace(/\.md$/, ''), readFileSync(path, 'utf-8'), statSync(path).mtime.toISOString())
    })
    // A post needs a title to be a post. This skips prose docs that live
    // alongside the posts, matching what the public blog considers renderable.
    .filter(p => !!p.title)
    .sort((a, b) => {
      if (a.featured !== b.featured)
        return a.featured ? -1 : 1
      return (b.date || '').localeCompare(a.date || '')
    })
}

export function getBlogPost(slug: string): BlogPost | null {
  const file = fileFor(slug)
  if (!existsSync(file))
    return null

  return hydrate(slug, readFileSync(file, 'utf-8'), statSync(file).mtime.toISOString())
}

/**
 * Create or update a post file.
 *
 * Pass `originalSlug` to rename: the new file is written first, then the old one
 * is removed, so a failure mid-way leaves the original post intact.
 */
export function saveBlogPost(input: BlogPostInput): BlogPost {
  const title = String(input.title ?? '').trim()
  if (!title)
    throw new BlogAdminError('A title is required.')

  const slug = assertSafeSlug(String(input.slug ?? '').trim() || slugify(title))
  const originalSlug = input.originalSlug ? assertSafeSlug(input.originalSlug) : ''
  const isRename = !!originalSlug && originalSlug !== slug

  // Creating over an existing file, or renaming onto one, would silently
  // destroy a published post. Both are refused.
  if (existsSync(fileFor(slug)) && (!originalSlug || isRename))
    throw new BlogAdminError(`A post with the slug "${slug}" already exists.`, 409)

  if (originalSlug && !existsSync(fileFor(originalSlug)))
    throw new BlogAdminError(`No post found with the slug "${originalSlug}".`, 404)

  const date = String(input.date ?? '').trim() || new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new BlogAdminError('Date must be in YYYY-MM-DD format.')

  const body = String(input.body ?? '').trim()
  const { wordCount, readingTime } = readingTimeFor(body)

  const post: BlogPost = {
    slug,
    title,
    description: String(input.description ?? '').trim(),
    date,
    author: String(input.author ?? '').trim(),
    authorBio: String(input.authorBio ?? '').trim(),
    poster: String(input.poster ?? '').trim(),
    featured: input.featured === true,
    draft: input.draft === true,
    body,
    wordCount,
    readingTime,
    updatedAt: new Date().toISOString(),
  }

  if (!existsSync(CONTENT_DIR))
    mkdirSync(CONTENT_DIR, { recursive: true })

  writeFileSync(fileFor(slug), toFileContents(post), 'utf-8')

  if (isRename)
    unlinkSync(fileFor(originalSlug))

  return post
}

export function deleteBlogPost(slug: string): boolean {
  const file = fileFor(slug)
  if (!existsSync(file))
    return false

  unlinkSync(file)

  return true
}
