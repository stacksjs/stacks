import { describe, expect, test } from 'bun:test'
import { buildContentOverview } from './ContentDashboardAction'

describe('content dashboard overview', () => {
  test('derives metrics, rankings, drafts, and charts from persisted rows', () => {
    const overview = buildContentOverview({
      days: 30,
      posts: [
        {
          id: 1,
          title: 'Published guide',
          status: 'published',
          views: 100,
          author_id: 1,
          published_at: '2026-07-10T00:00:00.000Z',
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-11T00:00:00.000Z',
        },
        {
          id: 2,
          title: 'Working draft',
          status: 'draft',
          views: 20,
          author_id: 1,
          published_at: null,
          created_at: '2026-06-20T00:00:00.000Z',
          updated_at: '2026-07-12T00:00:00.000Z',
        },
        {
          id: 3,
          title: 'Archived note',
          status: 'archived',
          views: 5,
          author_id: null,
          published_at: null,
          created_at: '2026-07-02T00:00:00.000Z',
          updated_at: null,
        },
      ],
      pages: [
        {
          id: 1,
          title: 'About',
          views: 50,
          published_at: '2026-07-03T00:00:00.000Z',
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
      comments: [
        {
          id: 1,
          author_name: 'Reader One',
          author_email: 'one@example.com',
          content: 'Useful',
          post_id: 1,
          post_title: 'Published guide',
          status: 'approved',
          created_at: '2026-07-12T00:00:00.000Z',
        },
        {
          id: 2,
          author_name: 'Reader Two',
          author_email: 'two@example.com',
          content: 'Question',
          post_id: 1,
          post_title: 'Published guide',
          status: 'pending',
          created_at: '2026-07-13T00:00:00.000Z',
        },
        {
          id: 3,
          author_name: null,
          author_email: null,
          content: 'Draft note',
          post_id: 2,
          post_title: 'Working draft',
          status: 'spam',
          created_at: '2026-07-11T00:00:00.000Z',
        },
      ],
      categories: [{ id: 10, name: 'Tutorials' }],
      categoryRelations: [
        { postId: 1, categoryId: 10 },
        { postId: 3, categoryId: 10 },
      ],
      authors: [{ id: 1, name: 'Ada' }],
    })

    expect(overview.stats).toEqual({
      posts: 3,
      pages: 1,
      comments: 3,
      views: 175,
    })
    expect(overview.topPosts[0]).toEqual(expect.objectContaining({
      id: 1,
      category: 'Tutorials',
      comments: 2,
      views: 100,
    }))
    expect(overview.drafts).toEqual([
      expect.objectContaining({
        id: 2,
        author: 'Ada',
        category: 'Uncategorized',
      }),
    ])
    expect(overview.recentComments.map(comment => comment.id)).toEqual([2, 1, 3])
    expect(overview.charts.views).toEqual({
      labels: ['Jun 2026', 'Jul 2026'],
      data: [20, 155],
    })
    expect(overview.charts.categories).toEqual({
      labels: ['Tutorials', 'Uncategorized'],
      data: [2, 1],
    })
  })
})
