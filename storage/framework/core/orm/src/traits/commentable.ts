import { db as _db, sql, sqlDateTime} from '@stacksjs/database'


function assertId(id: unknown, method: string): asserts id is number {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`[orm/commentable] ${method} requires a positive numeric id (received ${String(id)})`)
  }
}

/** Where comment upvotes live — see `database/src/trait-tables.ts`. */
const UPVOTES_TABLE = 'commentable_upvotes'

/**
 * The `upvoteable_type` written for a comment upvote. The column is
 * polymorphic so the table can carry upvotes for other targets later; comments
 * are keyed by the table their rows live in.
 */
const COMMENT_UPVOTE_TYPE = 'commentables'

/** Whether a driver error is a unique-constraint collision. */
function isDuplicateError(err: unknown): boolean {
  const e = err as { code?: string, errno?: number, message?: string }
  return e.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || e.code === 'SQLITE_CONSTRAINT'
    || e.code === '23505'
    || e.errno === 1062
    || /unique|duplicate/i.test(e.message ?? '')
}

export function createCommentableMethods(tableName: string) {
  const db = _db
  return {
    async comments(id: number): Promise<any[]> {
      assertId(id, 'comments')
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .selectAll()
        .execute()
    },

    async commentCount(id: number): Promise<number> {
      const result = await db
        .selectFrom('commentables')
        .select(sql`count(*) as count`)
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .executeTakeFirst()

      return Number((result)?.count) || 0
    },

    async addComment(id: number, comment: { title: string, body: string }): Promise<any> {
      assertId(id, 'addComment')
      if (!comment || typeof comment.title !== 'string' || comment.title.trim().length === 0) {
        throw new Error('[orm/commentable] addComment requires a non-empty comment.title')
      }
      if (typeof comment.body !== 'string' || comment.body.trim().length === 0) {
        throw new Error('[orm/commentable] addComment requires a non-empty comment.body')
      }
      const written = await db
        .insertInto('commentables')
        .values({
          ...comment,
          commentables_id: id,
          commentables_type: tableName,
          status: 'pending',
          created_at: sqlDateTime(),
          updated_at: sqlDateTime(),
        })
        .returningAll()
        .executeTakeFirst()

      // A RETURNING-capable driver hands back the row directly; SQLite hands
      // back { changes, lastInsertRowid }, so read the row by that id. Comments
      // have no natural unique key, hence the id rather than a re-query by value.
      if (written && typeof written === 'object' && 'id' in written)
        return written

      /*
       * `returningAll()` types this as the row, and on a RETURNING-capable
       * driver that is what arrives. SQLite hands back `{ changes,
       * lastInsertRowid }` instead, which the declared row type cannot express,
       * so the cast sits at exactly the point the driver and the type disagree.
       *
       * Untyped until `commentables` reached `database/types.d.ts`
       * (stacksjs/stacks#2409), which is what made the mismatch visible.
       */
      const insertedId = (written as { lastInsertRowid?: number | bigint } | undefined)?.lastInsertRowid
      if (insertedId == null)
        return written

      return await db
        .selectFrom('commentables')
        .where('id', '=', Number(insertedId))
        .selectAll()
        .executeTakeFirst()
    },

    async approvedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'approved')
        .selectAll()
        .execute()
    },

    async pendingComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'pending')
        .selectAll()
        .execute()
    },

    async rejectedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'rejected')
        .selectAll()
        .execute()
    },

    /**
     * Upvote a comment. Idempotent — a repeat call returns the existing row
     * rather than tripping the unique (target, user) index.
     *
     * These four take a COMMENT id, not the owning record's id, so — like
     * `likeable`'s `likedBy` — they are reachable only through the static bag
     * (`Model._commentable.upvoteComment(...)`) and are deliberately absent
     * from TRAIT_INSTANCE_METHOD_BINDINGS, whose 'id' mode would inject the
     * wrong id.
     */
    async upvoteComment(commentId: number, userId: number): Promise<any> {
      assertId(commentId, 'upvoteComment')
      assertId(userId, 'upvoteComment')

      const existing = () => db
        .selectFrom(UPVOTES_TABLE)
        .where('upvoteable_id', '=', commentId)
        .where('upvoteable_type', '=', COMMENT_UPVOTE_TYPE)
        .where('user_id', '=', userId)
        .selectAll()
        .executeTakeFirst()

      const already = await existing()
      if (already)
        return already

      try {
        await db
          .insertInto(UPVOTES_TABLE)
          .values({
            upvoteable_id: commentId,
            upvoteable_type: COMMENT_UPVOTE_TYPE,
            user_id: userId,
            created_at: sqlDateTime(),
          })
          .execute()
      }
      catch (err: unknown) {
        // Two concurrent upvotes race between the check above and the insert;
        // the unique index is what actually settles it. Anything that is not
        // that collision is a real failure and must surface.
        if (!isDuplicateError(err))
          throw err
      }

      return await existing()
    },

    /** Remove a user's upvote. A no-op when they had not upvoted. */
    async removeCommentUpvote(commentId: number, userId: number): Promise<void> {
      assertId(commentId, 'removeCommentUpvote')
      assertId(userId, 'removeCommentUpvote')
      await db
        .deleteFrom(UPVOTES_TABLE)
        .where('upvoteable_id', '=', commentId)
        .where('upvoteable_type', '=', COMMENT_UPVOTE_TYPE)
        .where('user_id', '=', userId)
        .execute()
    },

    async commentUpvoteCount(commentId: number): Promise<number> {
      assertId(commentId, 'commentUpvoteCount')
      const result = await db
        .selectFrom(UPVOTES_TABLE)
        // Plain-string select, not a `sql` fragment — bun-query-builder joins
        // select arguments with `.join(', ')` and a fragment stringifies to
        // "[object Object]". Same reasoning as likeable's likeCount().
        .select('count(*) as count')
        .where('upvoteable_id', '=', commentId)
        .where('upvoteable_type', '=', COMMENT_UPVOTE_TYPE)
        .executeTakeFirst()

      return Number((result)?.count) || 0
    },

    async hasUpvotedComment(commentId: number, userId: number): Promise<boolean> {
      assertId(commentId, 'hasUpvotedComment')
      assertId(userId, 'hasUpvotedComment')
      const row = await db
        .selectFrom(UPVOTES_TABLE)
        .where('upvoteable_id', '=', commentId)
        .where('upvoteable_type', '=', COMMENT_UPVOTE_TYPE)
        .where('user_id', '=', userId)
        .selectAll()
        .executeTakeFirst()

      return !!row
    },
  }
}
