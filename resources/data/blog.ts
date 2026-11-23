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

/** What /api/email/subscribe can answer, as `?subscribe=<outcome>`. */
export type SubscribeOutcome = 'subscribed' | 'already' | 'invalid' | 'busy' | 'error'

/**
 * What a reader is told for each outcome. One table for both paths: the
 * page reads it when a plain form post comes back with `?subscribe=`, and
 * the in-place script (resources/data/signup.ts) carries the same table, so
 * the two can never say different things.
 */
export const subscribeMessages: Record<SubscribeOutcome, SubscribeNotice> = {
  subscribed: { tone: 'success', text: 'Thanks, you are on the list. A welcome email is on its way to your inbox.' },
  already: { tone: 'success', text: 'You are already on the list. We will write the day Stacks opens up.' },
  invalid: { tone: 'error', text: 'That email address did not look right. Try it again?' },
  busy: { tone: 'error', text: 'That was a lot of tries in a minute. Give it a moment and try again.' },
  error: { tone: 'error', text: 'Something went wrong on our side and you are not on the list yet. Please try again.' },
}

/**
 * What to tell a reader whose signup form posted without JavaScript and came
 * back with `?subscribe=<outcome>` (see form-return.ts in the default
 * actions). With JavaScript the form answers in place instead.
 */
export function subscribeNotice(query: unknown): SubscribeNotice | null {
  const outcome = query && typeof query === 'object' ? String((query as Record<string, unknown>).subscribe || '') : ''
  return Object.hasOwn(subscribeMessages, outcome) ? subscribeMessages[outcome as SubscribeOutcome] : null
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
