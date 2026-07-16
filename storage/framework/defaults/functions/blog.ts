/**
 * Markdown blog admin client.
 *
 * Talks to `/api/dashboard/blog`, which reads and writes `content/blog/*.md` —
 * the same files BunPress renders at `/blog`. Saving here changes a file in the
 * repo, so the dashboard is an editor for git-tracked content, not a database UI.
 *
 * Deliberately dependency-free: no `@stacksjs/stx`, no `@stacksjs/browser`, no
 * signals. The stx client bundler marks those packages external and strips the
 * import when it inlines this module into a page's setup function, which leaves
 * the identifiers undefined at runtime. Reactive state therefore lives in the
 * PAGE's `<script client>` block, where the runtime injects `state`/`derived`,
 * and this module stays a plain async transport that returns data or throws.
 *
 * Server side: storage/framework/core/actions/src/blog-admin.ts
 */

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
  body: string
  wordCount: number
  readingTime: number
  updatedAt: string
}

export type BlogPostDraft = Omit<BlogPost, 'wordCount' | 'readingTime' | 'updatedAt'>

const api = '/api/dashboard/blog'

/**
 * Headers for an unsafe (write) request.
 *
 * CSRF protection is default-on for POST/PATCH/DELETE and uses a stateless
 * double-submit cookie: the server seeds a non-HttpOnly `X-CSRF-Token` cookie on
 * safe responses, and the client has to echo it back in the matching header. The
 * list request on page load is what seeds the cookie, so by the time an author
 * can save, the token is there. See defaults/app/Middleware/Csrf.ts.
 */
function writeHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const match = document.cookie.match(/(?:^|;\s*)X-CSRF-Token=([^;]*)/)

  if (match)
    headers['X-CSRF-Token'] = decodeURIComponent(match[1])

  return headers
}

/**
 * Throws with the API's own message when there is one.
 *
 * The blog endpoints answer a rejected write with `{ message }` (slug taken,
 * bad date, ...). Surfacing that beats a bare status code, since it is the text
 * the author needs in order to fix the post.
 */
async function unwrap<T>(response: Response): Promise<T> {
  if (response.ok)
    return await response.json() as T

  let message = `Request failed with status ${response.status}`

  try {
    const body = await response.json() as { message?: string }
    if (body?.message)
      message = body.message
  }
  catch {
    // Non-JSON error body; the status-code message stands.
  }

  throw new Error(message)
}

export interface BlogListResponse {
  posts: BlogPost[]
  publishedCount: number
  draftCount: number
  featuredCount: number
}

/** Every post on disk, drafts included. Bodies are omitted from the list. */
export async function fetchBlogPosts(): Promise<BlogListResponse> {
  const body = await unwrap<BlogListResponse>(await fetch(api))

  if (!Array.isArray(body?.posts))
    throw new TypeError('The blog API returned an unexpected shape.')

  return body
}

/** One post including its markdown body, which the list omits. */
export async function fetchBlogPost(slug: string): Promise<BlogPost> {
  return await unwrap<BlogPost>(await fetch(`${api}/${encodeURIComponent(slug)}`))
}

/** Creates a post, or updates the one at `originalSlug`. */
export async function saveBlogPost(post: BlogPostDraft, originalSlug = ''): Promise<BlogPost> {
  const isUpdate = !!originalSlug

  return await unwrap<BlogPost>(await fetch(isUpdate ? `${api}/${encodeURIComponent(originalSlug)}` : api, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(post),
  }))
}

export async function deleteBlogPost(slug: string): Promise<void> {
  await unwrap<{ message: string }>(await fetch(`${api}/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  }))
}
