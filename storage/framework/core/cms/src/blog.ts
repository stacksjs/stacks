/**
 * Markdown blog posts from `content/blog`, for stx-native blog pages.
 *
 * A post is a markdown file, `content/blog/<slug>.md`, with one `key: value`
 * per frontmatter line. It ships with the commit that adds it: no table, no
 * seeder, no admin write in production. The views server reads the same
 * folder for `/blog/feed.xml` and for the blog's entries in `/sitemap.xml`
 * (`@stacksjs/actions` blog.ts, switched to feed-only when the app has a
 * `resources/views/blog.stx`), and it reads it with this module, so the pages,
 * the feed and the sitemap always agree on what is published.
 *
 * ```ts
 * // resources/views/blog.stx
 * import { formatPostDate, loadPosts } from '@stacksjs/cms/blog'
 * const posts = loadPosts()
 *
 * // resources/views/blog/[slug].stx
 * import { loadPost, renderPostBody } from '@stacksjs/cms/blog'
 * const post = loadPost(useRoute().params?.slug)
 * if (!post) notFound()
 * const html = renderPostBody(post.body)   // then {!! html !!}
 * ```
 *
 * Frontmatter:
 *
 * | key | meaning |
 * |---|---|
 * | `title`, `date` | required; `date` is `YYYY-MM-DD` |
 * | `description` | the excerpt, the feed's description and the page's meta description |
 * | `draft: true` | hidden from the listing, the post's URL, the feed and the sitemap |
 * | `featured: true` | listed first |
 * | `author` | the plain-text byline the feed prints |
 * | `authors: chris, pawel` | usernames behind the byline, in order |
 * | `author.<username>.name` / `.avatar` / `.bio` | that author's fallbacks, and a `.bio` that wins over their profile's |
 * | `authorUsername`, `authorAvatar`, `authorBio` | the single-author form of the same |
 * | `image`, `imageAlt` | the link-preview picture |
 *
 * The author keys are flat because the parser reads one `key: value` per line,
 * the same reading the feed has always used.
 *
 * Authors are resolved through a lookup the app supplies, usually its own
 * public profiles; see `createAuthorResolver`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { renderPostHtml } from './article'

export interface PostMeta {
  slug: string
  title: string
  /** `YYYY-MM-DD`, as written in the frontmatter. */
  date: string
  description: string
  /** The plain-text byline, as the RSS feed prints it. */
  author: string
  /** Who wrote it, in byline order, with the frontmatter's fallbacks. */
  authors: AuthorRef[]
  image: string
  imageAlt: string
  featured: boolean
  /** Whole minutes at 230 words a minute, never less than one. */
  minutes: number
  /** Every frontmatter key, for an app's own keys. */
  frontmatter: Record<string, string>
}

export interface Post extends PostMeta {
  /** The markdown body, frontmatter removed. */
  body: string
}

/** An author as a post's frontmatter names them. */
export interface AuthorRef {
  /** Their username in the app, or '' for a byline with nothing behind it. */
  username: string
  name: string
  avatar: string
  bio: string
}

/** What an app knows about an author, from its `AuthorLookup`. */
export interface AuthorProfile {
  name?: string
  initials?: string
  avatar?: string
  bio?: string
  /** Where the byline links, usually their public profile. */
  url?: string
}

/** Finds an author by username: their profile, or null when there is none to show. */
export type AuthorLookup = (username: string) => Promise<AuthorProfile | null | undefined> | AuthorProfile | null | undefined

/** An author as a byline shows them. */
export interface PostAuthor {
  name: string
  initials: string
  avatar: string
  bio: string
  /** Where their name links, or '' for no link. */
  url: string
}

export interface BlogDirOptions {
  /** The posts folder. Default `<cwd>/content/blog`. */
  dir?: string
}

/** The posts folder: `<cwd>/content/blog`. */
export function blogContentDir(): string {
  return join(process.cwd(), 'content/blog')
}

/** A post's file name without `.md`, and so never a path. */
const SLUG = /^[A-Za-z0-9][\w-]{0,199}$/

/** A username an author lookup may be asked about. */
const USERNAME = /^[a-z0-9][a-z0-9_-]{0,99}$/

/** Whether a string can name a post (letters, digits, `-`, `_`; no dots or slashes). */
export function isPostSlug(slug: string): boolean {
  return SLUG.test(slug)
}

/**
 * `key: value` lines between `---` fences, quotes optional. A value may
 * contain colons; only the first one separates the key.
 */
export function parseFrontmatter(markdown: string): { data: Record<string, string>, body: string } {
  const match = markdown.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match)
    return { data: {}, body: markdown }

  const data: Record<string, string> = {}
  for (const line of (match[1] ?? '').split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1)
      continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
      value = value.slice(1, -1)
    if (key)
      data[key] = value
  }
  return { data, body: match[2] ?? '' }
}

/**
 * Whether frontmatter describes a published post: a title and a date, and no
 * `draft: true`. Files without both (a STRATEGY.md, notes) are not posts.
 */
export function isPublished(data: Record<string, string>): boolean {
  return !!data.title && !!data.date && data.draft !== 'true'
}

/** Whole minutes to read a markdown body at 230 words a minute, at least one. Code blocks are skipped. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split(/\s+/)
    .filter(word => /[\p{L}\p{N}]/u.test(word))
    .length
  return Math.max(1, Math.round(words / 230))
}

/**
 * The authors a post's frontmatter names: `authors: chris, pawel` (brackets
 * and quotes allowed), each with its `author.<username>.*` fallbacks, or the
 * single-author keys.
 */
export function authorsOf(data: Record<string, string>): AuthorRef[] {
  const usernames = (data.authors ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(name => name.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(name => USERNAME.test(name))

  if (usernames.length > 0) {
    return [...new Set(usernames)].map(username => ({
      username,
      name: data[`author.${username}.name`] ?? '',
      avatar: data[`author.${username}.avatar`] ?? '',
      bio: data[`author.${username}.bio`] ?? '',
    }))
  }

  const username = (data.authorUsername ?? '').toLowerCase()
  if (!data.author && !username)
    return []
  return [{
    username: USERNAME.test(username) ? username : '',
    name: data.author ?? '',
    avatar: data.authorAvatar ?? '',
    bio: data.authorBio ?? '',
  }]
}

function toPost(slug: string, markdown: string): Post | null {
  const { data, body } = parseFrontmatter(markdown)
  if (!isPublished(data))
    return null

  return {
    slug,
    title: data.title!,
    date: data.date!,
    description: data.description ?? '',
    author: data.author ?? '',
    authors: authorsOf(data),
    image: data.image ?? '',
    imageAlt: data.imageAlt ?? '',
    featured: data.featured === 'true',
    minutes: readingMinutes(body),
    frontmatter: data,
    body,
  }
}

/** Featured first, then newest first. */
export function sortPosts<T extends Pick<PostMeta, 'date' | 'featured'>>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.featured !== b.featured)
      return a.featured ? -1 : 1
    return b.date.localeCompare(a.date)
  })
}

/** Every published post, featured first and then newest first, without bodies. */
export function loadPosts(options: BlogDirOptions = {}): PostMeta[] {
  const dir = options.dir ?? blogContentDir()
  if (!existsSync(dir))
    return []

  const posts: PostMeta[] = []
  for (const file of readdirSync(dir)) {
    const slug = file.replace(/\.md$/, '')
    if (!file.endsWith('.md') || !SLUG.test(slug))
      continue
    const post = toPost(slug, readFileSync(join(dir, file), 'utf8'))
    if (post) {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { body, ...meta } = post
      posts.push(meta)
    }
  }
  return sortPosts(posts)
}

/** One published post with its body, or null for a draft, an unsafe slug or no such file. */
export function loadPost(slug: unknown, options: BlogDirOptions = {}): Post | null {
  const name = String(slug ?? '')
  if (!SLUG.test(name))
    return null
  const file = join(options.dir ?? blogContentDir(), `${name}.md`)
  if (!existsSync(file))
    return null
  return toPost(name, readFileSync(file, 'utf8'))
}

/**
 * A post body as HTML: Bun's markdown parser, then `renderPostHtml`, which
 * turns a lone image into a captioned figure, consecutive images into a grid
 * and a bare video link into an embed. Pair it with `articleHead()` for the
 * figure and grid styles.
 */
export function renderPostBody(markdown: string, options: { publicDir?: string } = {}): string {
  return renderPostHtml(Bun.markdown.html(markdown), { publicDir: options.publicDir ?? join(process.cwd(), 'public') })
}

/** "October 11, 2026". A post date is a calendar day, so it is read as UTC. */
export function formatPostDate(date: string, locale = 'en-US'): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()))
    return date
  return parsed.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "CB" for "Chris Breuer", first and last word. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase()
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1)
    return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export interface AuthorResolverOptions {
  /** Finds an author's profile by username. Without one, the frontmatter is all there is. */
  lookup?: AuthorLookup
  /** How long a lookup's answer, including "none", is kept. Default ten minutes; 0 keeps nothing. */
  ttlMs?: number
  /** The byline for a post that names nobody. Default the app name, else "Blog". */
  fallbackName?: string
}

export interface AuthorResolver {
  /** Every author of a post, in byline order. */
  (post: Pick<PostMeta, 'authors'>): Promise<PostAuthor[]>
  /** One author. */
  one: (ref: AuthorRef) => Promise<PostAuthor>
  /** Forget every cached lookup. */
  clear: () => void
}

/**
 * Resolves bylines through the app's own profiles.
 *
 * Each author is looked up by username; a profile's name, initials, picture
 * and link win, and the post's own frontmatter fills whatever it does not
 * have. A `bio` in the frontmatter wins over the profile's, so a post can say
 * what it means to about its writer. A lookup that throws, or answers null,
 * leaves the frontmatter standing, without a link.
 *
 * Create it once at module scope so its cache outlives a render:
 *
 * ```ts
 * export const resolveAuthors = createAuthorResolver({
 *   lookup: async (username) => {
 *     const res = await fetch(`${api}/api/u/${username}`)
 *     const { profile } = res.ok ? await res.json() : {}
 *     return profile ? { ...profile, url: `/${profile.username}` } : null
 *   },
 * })
 * ```
 */
export function createAuthorResolver(options: AuthorResolverOptions = {}): AuthorResolver {
  const ttl = options.ttlMs ?? 10 * 60 * 1000
  const cache = new Map<string, { at: number, profile: AuthorProfile | null }>()

  async function profileOf(username: string): Promise<AuthorProfile | null> {
    if (!options.lookup || !username || !USERNAME.test(username))
      return null
    const cached = cache.get(username)
    if (cached && Date.now() - cached.at < ttl)
      return cached.profile

    let profile: AuthorProfile | null = null
    try {
      profile = (await options.lookup(username)) ?? null
    }
    catch {
      profile = null
    }
    if (ttl > 0)
      cache.set(username, { at: Date.now(), profile })
    return profile
  }

  const one = async (ref: AuthorRef): Promise<PostAuthor> => {
    const profile = await profileOf(ref.username)
    const name = String(profile?.name || ref.name || ref.username || options.fallbackName || process.env.APP_NAME || 'Blog')
    return {
      name,
      initials: String(profile?.initials || initialsOf(name)),
      avatar: String(profile?.avatar || ref.avatar || ''),
      bio: String(ref.bio || profile?.bio || ''),
      url: String(profile?.url || ''),
    }
  }

  const resolve = (async (post: Pick<PostMeta, 'authors'>): Promise<PostAuthor[]> => {
    const refs = post.authors.length > 0 ? post.authors : [{ username: '', name: '', avatar: '', bio: '' }]
    return Promise.all(refs.map(one))
  }) as AuthorResolver
  resolve.one = one
  resolve.clear = () => cache.clear()
  return resolve
}

/**
 * The byline as a template draws it: each author with the words before their
 * name (`''`, `', '` or `' and '`) and an inline style that paints their
 * picture as a background. Lay that over their initials and a picture that
 * fails to load leaves the initials showing rather than an empty circle.
 */
export function bylineOf(authors: PostAuthor[]): Array<PostAuthor & { joiner: string, avatarStyle: string }> {
  return authors.map((author, index) => ({
    ...author,
    joiner: index === 0 ? '' : index === authors.length - 1 ? ' and ' : ', ',
    avatarStyle: author.avatar ? `background-image:url(${JSON.stringify(author.avatar)})` : '',
  }))
}
