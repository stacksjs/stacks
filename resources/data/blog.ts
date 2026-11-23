/**
 * The blog, as the marketing pages draw it.
 *
 * Posts are markdown files in content/blog, read by `@stacksjs/cms/blog`: the
 * same reader the RSS feed and the sitemap use, so the three cannot disagree
 * about what is published. The blog used to be a separate BunPress build with
 * its own nav, palette and theme toggle, which made a click on "Blog" feel
 * like leaving the site. It is now two ordinary views (resources/views/blog.stx
 * and blog/[slug].stx) on the marketing partials, and this module is what they
 * share.
 */

import type { PostMeta } from '@stacksjs/cms/blog'
import { formatPostDate, initialsOf, loadPost, loadPosts, renderPostBody } from '@stacksjs/cms/blog'

export interface BlogCard {
  slug: string
  url: string
  title: string
  description: string
  date: string
  dateLabel: string
  minutes: number
  author: string
  featured: boolean
}

function toCard(post: PostMeta): BlogCard {
  return {
    slug: post.slug,
    url: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    date: post.date,
    dateLabel: formatPostDate(post.date),
    minutes: post.minutes,
    author: post.author || 'The Stacks Team',
    featured: post.featured,
  }
}

/** Every published post, featured first and then newest first. */
export function blogCards(): BlogCard[] {
  return loadPosts().map(toCard)
}

export interface BlogArticle extends BlogCard {
  html: string
  authorInitials: string
  authorBio: string
  /** Written as the team rather than a person, so the byline shows the mark, not initials. */
  byTeam: boolean
  /** True when the body carries figures, so the page needs the article styles. */
  hasMedia: boolean
}

/** One post, rendered, or null for a draft or a slug that names nothing. */
export function blogArticle(slug: unknown): BlogArticle | null {
  const post = loadPost(slug)
  if (!post)
    return null

  const html = renderPostBody(post.body)
  const card = toCard(post)

  return {
    ...card,
    html,
    authorInitials: initialsOf(card.author).slice(0, 2) || 'S',
    authorBio: post.frontmatter.authorBio || '',
    byTeam: /\bteam\b/i.test(card.author),
    hasMedia: /<(figure|iframe)\b/.test(html),
  }
}

/** Up to `count` other posts, for the end of an article. */
export function otherPosts(slug: string, count = 2): BlogCard[] {
  return blogCards().filter(post => post.slug !== slug).slice(0, count)
}

export interface SubscribeNotice {
  tone: 'success' | 'error'
  text: string
}

/**
 * What to tell a reader who has just submitted a signup form.
 *
 * The forms post to /api/email/subscribe without JavaScript, and the API
 * sends the browser back with `?subscribe=<outcome>` (see form-return.ts in
 * the default actions), so the page renders the answer itself, in place.
 */
export function subscribeNotice(query: unknown): SubscribeNotice | null {
  const outcome = query && typeof query === 'object' ? String((query as Record<string, unknown>).subscribe || '') : ''

  switch (outcome) {
    case 'subscribed':
      return { tone: 'success', text: 'You are on the list. Check your inbox for a confirmation link.' }
    case 'already':
      return { tone: 'success', text: 'You are already on the list. We will write when there is news.' }
    case 'invalid':
      return { tone: 'error', text: 'That email address did not look right. Try it again?' }
    default:
      return null
  }
}

/** Share links for a post, built from its canonical URL. */
export function shareLinks(url: string, title: string): Array<{ label: string, icon: string, href: string }> {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)

  return [
    { label: 'Share on X', icon: 'i-hugeicons-new-twitter', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'Share on Bluesky', icon: 'i-hugeicons-bluesky', href: `https://bsky.app/intent/compose?text=${t}%20${u}` },
    { label: 'Share on LinkedIn', icon: 'i-hugeicons-linkedin-01', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ]
}
