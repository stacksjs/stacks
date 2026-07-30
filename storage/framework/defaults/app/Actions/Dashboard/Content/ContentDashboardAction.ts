import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

const ALLOWED_RANGES = new Set([1, 7, 30, 90, 365])

export interface ContentOverviewPostRow {
  id: number
  title: string
  status: string | null
  views: number | null
  author_id: number | null
  published_at: string | null
  created_at: string
  updated_at: string | null
}

export interface ContentOverviewPageRow {
  id: number
  title: string
  views: number | null
  published_at: string | null
  created_at: string
}

export interface ContentOverviewCommentRow {
  id: number
  author_name: string | null
  author_email: string | null
  content: string | null
  post_id: number | null
  post_title: string | null
  status: string | null
  created_at: string
}

export interface ContentOverviewRelationRow {
  postId: number
  categoryId: number
}

interface NamedRow {
  id: number
  name: string
}

interface ContentOverviewInput {
  posts: ContentOverviewPostRow[]
  pages: ContentOverviewPageRow[]
  comments: ContentOverviewCommentRow[]
  categories: NamedRow[]
  categoryRelations: ContentOverviewRelationRow[]
  authors: NamedRow[]
  days: number
}

function normalizedStatus(value: string | null): string {
  const status = String(value || 'draft').toLowerCase()
  return status === 'published' || status === 'archived' ? status : 'draft'
}

function monthKey(value: string | null): string | null {
  if (!value)
    return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return null
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year || 1970, (month || 1) - 1, 1)))
}

export function buildContentOverview(input: ContentOverviewInput) {
  const authors = new Map(input.authors.map(author => [Number(author.id), String(author.name || '')]))
  const categories = new Map(input.categories.map(category => [Number(category.id), String(category.name || '')]))
  const categoryIdsByPost = new Map<number, number[]>()

  for (const relation of input.categoryRelations) {
    const postId = Number(relation.postId)
    categoryIdsByPost.set(postId, [...(categoryIdsByPost.get(postId) || []), Number(relation.categoryId)])
  }

  const commentCountsByPost = new Map<number, number>()
  for (const comment of input.comments) {
    if (comment.post_id == null)
      continue
    const postId = Number(comment.post_id)
    commentCountsByPost.set(postId, (commentCountsByPost.get(postId) || 0) + 1)
  }

  const posts = input.posts.map(post => ({
    ...post,
    id: Number(post.id),
    status: normalizedStatus(post.status),
    views: Number(post.views || 0),
  }))
  const pages = input.pages.map(page => ({
    ...page,
    id: Number(page.id),
    views: Number(page.views || 0),
  }))

  const topPosts = [...posts]
    .sort((left, right) => right.views - left.views || right.id - left.id)
    .slice(0, 5)
    .map(post => ({
      id: post.id,
      title: String(post.title || ''),
      category: categories.get(categoryIdsByPost.get(post.id)?.[0] || 0) || 'Uncategorized',
      views: post.views,
      comments: commentCountsByPost.get(post.id) || 0,
      publishedAt: post.published_at || post.created_at,
      status: post.status,
    }))

  const recentComments = [...input.comments]
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, 5)
    .map(comment => ({
      id: Number(comment.id),
      author: String(comment.author_name || 'Anonymous'),
      email: String(comment.author_email || ''),
      content: String(comment.content || ''),
      postId: comment.post_id == null ? null : Number(comment.post_id),
      postTitle: String(comment.post_title || ''),
      createdAt: String(comment.created_at || ''),
      status: String(comment.status || 'pending').toLowerCase(),
    }))

  const drafts = posts
    .filter(post => post.status === 'draft')
    .sort((left, right) => String(right.updated_at || right.created_at).localeCompare(String(left.updated_at || left.created_at)))
    .slice(0, 5)
    .map(post => ({
      id: post.id,
      title: String(post.title || ''),
      category: categories.get(categoryIdsByPost.get(post.id)?.[0] || 0) || 'Uncategorized',
      author: authors.get(Number(post.author_id || 0)) || 'Unassigned',
      updatedAt: post.updated_at || post.created_at,
    }))

  const viewsByMonth = new Map<string, number>()
  for (const content of [...posts, ...pages]) {
    const key = monthKey(content.published_at || content.created_at)
    if (key)
      viewsByMonth.set(key, (viewsByMonth.get(key) || 0) + content.views)
  }
  const viewKeys = [...viewsByMonth.keys()].sort()

  const categoryCounts = new Map<string, number>()
  for (const post of posts) {
    const names = (categoryIdsByPost.get(post.id) || [])
      .map(categoryId => categories.get(categoryId))
      .filter((name): name is string => Boolean(name))
    const resolved = names.length > 0 ? names : ['Uncategorized']
    for (const name of resolved)
      categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1)
  }
  const categoryRows = [...categoryCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))

  return {
    rangeDays: input.days,
    stats: {
      posts: posts.length,
      pages: pages.length,
      comments: input.comments.length,
      views: posts.reduce((sum, post) => sum + post.views, 0) + pages.reduce((sum, page) => sum + page.views, 0),
    },
    topPosts,
    recentComments,
    drafts,
    charts: {
      views: {
        labels: viewKeys.map(monthLabel),
        data: viewKeys.map(key => viewsByMonth.get(key) || 0),
      },
      categories: {
        labels: categoryRows.map(([name]) => name),
        data: categoryRows.map(([, count]) => count),
      },
    },
  }
}

function requestedDays(request: RequestInstance): number {
  const value = Number(request.get('days') || 30)
  if (value === 0)
    return 0
  return ALLOWED_RANGES.has(value) ? value : 30
}

function threshold(days: number): string | null {
  if (days === 0)
    return null
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

export default new Action({
  name: 'ContentDashboardAction',
  description: 'Returns persisted CMS overview metrics and recent content.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const days = requestedDays(request)
    const since = threshold(days)

    const postQuery = db
      .selectFrom('posts')
      .select(['id', 'title', 'status', 'views', 'author_id', 'published_at', 'created_at', 'updated_at'])
    const pageQuery = db
      .selectFrom('pages')
      .select(['id', 'title', 'views', 'published_at', 'created_at'])
    const commentQuery = db
      .selectFrom('comments')
      .select(['id', 'author_name', 'author_email', 'content', 'post_id', 'post_title', 'status', 'created_at'])

    const [posts, pages, comments, categories, authors] = await Promise.all([
      (since ? postQuery.where('created_at', '>=', since) : postQuery).execute() as unknown as Promise<ContentOverviewPostRow[]>,
      (since ? pageQuery.where('created_at', '>=', since) : pageQuery).execute() as unknown as Promise<ContentOverviewPageRow[]>,
      (since ? commentQuery.where('created_at', '>=', since) : commentQuery).execute() as unknown as Promise<ContentOverviewCommentRow[]>,
      db.selectFrom('categories').select(['id', 'name']).execute() as unknown as Promise<NamedRow[]>,
      db.selectFrom('authors').select(['id', 'name']).execute() as unknown as Promise<NamedRow[]>,
    ])

    const postIds = posts.map(post => Number(post.id))
    const categoryRelations = postIds.length > 0
      ? await db
          .selectFrom('categorizable_models')
          .whereIn('categorizable_id', postIds)
          .where('categorizable_type', '=', 'posts')
          .select(['categorizable_id as postId', 'category_id as categoryId'])
          .execute() as unknown as ContentOverviewRelationRow[]
      : []

    return buildContentOverview({
      posts,
      pages,
      comments,
      categories,
      categoryRelations,
      authors,
      days,
    })
  },
})
