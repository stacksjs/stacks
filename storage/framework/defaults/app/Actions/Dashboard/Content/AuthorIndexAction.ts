import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface AuthorRow {
  id: number
  name: string | null
  email: string | null
  bio: string | null
  avatar: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * `GET /api/dashboard/authors` — backs `views/dashboard/content/authors/index.stx`.
 *
 * Reads straight from the `authors` table via `db` rather than the ORM model:
 * `Author` from `@stacksjs/orm` exposes no query methods today, so the previous
 * `Author.all()` call threw on every request — and the action caught it and
 * served five hardcoded "Jane Doe" rows, which made an empty (or broken)
 * dashboard look populated. There is deliberately no fallback now: a failure
 * here must surface as a failure.
 *
 * `postCount` is derived here rather than read off the row. The `authors` table
 * has no counter column, and nothing would maintain one if it did.
 */
export default new Action({
  name: 'AuthorIndexAction',
  description: 'Returns CMS authors for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const [rows, postAuthors] = await Promise.all([
      db.selectFrom('authors').selectAll().orderBy('created_at', 'desc').execute() as unknown as Promise<AuthorRow[]>,
      db.selectFrom('posts').select(['author_id']).execute() as unknown as Promise<Array<{ author_id: number | null }>>,
    ])

    const postCounts = new Map<number, number>()
    for (const post of postAuthors) {
      if (post.author_id == null)
        continue

      const id = Number(post.author_id)
      postCounts.set(id, (postCounts.get(id) || 0) + 1)
    }

    const authors = rows.map(row => ({
      id: Number(row.id),
      name: String(row.name || ''),
      email: String(row.email || ''),
      bio: String(row.bio || ''),
      avatar: String(row.avatar || ''),
      postCount: postCounts.get(Number(row.id)) || 0,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))

    // Posts whose author no longer exists are not counted: the stat means
    // "posts reachable from this list", which is what the page's Assigned Posts
    // tile claims to show.
    const assignedPostCount = authors.reduce((sum, author) => sum + author.postCount, 0)

    return { authors, assignedPostCount }
  },
})
