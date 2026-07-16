import type { BlogPostInput } from '@stacksjs/actions'
import type { RequestInstance } from '@stacksjs/types'

/**
 * `true` only for values that actually mean true over the wire.
 *
 * A JSON body gives real booleans, but a form post gives `"true"` / `"on"` and
 * an unchecked box gives nothing at all. Without this the string `"false"` would
 * be truthy and every post would save as a draft.
 */
function bool(value: unknown): boolean {
  if (typeof value === 'boolean')
    return value

  return value === 'true' || value === 'on' || value === 1 || value === '1'
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

/**
 * The slug the caller wants the post to HAVE, read from the request body only.
 *
 * `request.get('slug')` cannot be used here: the update route is `/blog/{slug}`,
 * and `get()` resolves the route param, which shadows the body field of the same
 * name. That silently turned every rename into a no-op, because the "new" slug
 * always came back as the current one.
 */
function bodySlug(request: RequestInstance): string {
  const body = (request.jsonBody ?? request.formBody) as Record<string, unknown> | undefined

  return str(body?.slug)
}

/**
 * Maps a request body onto the blog-admin input shape.
 *
 * `originalSlug` is passed in by the update action (from the route param) rather
 * than read from the body, so a create can never be mistaken for a rename.
 */
export function blogPayload(request: RequestInstance, originalSlug = ''): BlogPostInput {
  return {
    slug: bodySlug(request),
    originalSlug,
    title: str(request.get('title')),
    description: str(request.get('description')),
    date: str(request.get('date')),
    author: str(request.get('author')),
    authorBio: str(request.get('authorBio')),
    poster: str(request.get('poster')),
    featured: bool(request.get('featured')),
    draft: bool(request.get('draft')),
    body: str(request.get('body')),
  }
}
