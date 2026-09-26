import { db as _db, sql, sqlDateTime } from '@stacksjs/database/runtime'


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

/** The fields a caller may set on a new comment. */
export interface NewComment {
  body: string
  /** Optional: most comment forms have no subject line. */
  title?: string | null
  /** A guest commenter's display name, for comments left without an account. */
  author_name?: string | null
  /** A guest commenter's email. Stored for the site owner, never meant for display. */
  author_email?: string | null
  /** The signed-in commenter, when there is one. */
  user_id?: number | null
}

export interface AddCommentOptions {
  /**
   * `'pending'` (the default) holds the comment for moderation. `'approved'`
   * publishes it immediately, for sites that moderate after the fact.
   */
  status?: 'pending' | 'approved'
}

const COMMENT_STATUSES_ON_CREATE: readonly string[] = ['pending', 'approved']

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
        .orderBy('id', 'asc')
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

    /**
     * Attach a comment to the record with this id.
     *
     * Only the fields in {@link NewComment} are written. The rest of the row
     * belongs to the trait: the owner, the timestamps, and the status, which
     * a caller picks through `options` rather than the comment itself so a
     * form body passed straight through cannot approve its own comment or
     * move it to another record.
     */
    async addComment(id: number, comment: NewComment, options: AddCommentOptions = {}): Promise<any> {
      assertId(id, 'addComment')
      if (!comment || typeof comment.body !== 'string' || comment.body.trim().length === 0) {
        throw new Error('[orm/commentable] addComment requires a non-empty comment.body')
      }
      // Optional: a reply on a blog has no subject line. The column is NOT
      // NULL, so an absent title is stored as the empty string.
      if (comment.title != null && typeof comment.title !== 'string') {
        throw new Error('[orm/commentable] addComment requires comment.title to be a string when given')
      }

      const status = options.status ?? 'pending'
      if (!COMMENT_STATUSES_ON_CREATE.includes(status)) {
        throw new Error(`[orm/commentable] addComment status must be one of ${COMMENT_STATUSES_ON_CREATE.join(', ')} (received ${String(status)})`)
      }

      const values: Record<string, unknown> = {
        title: comment.title?.trim() ?? '',
        body: comment.body,
        commentables_id: id,
        commentables_type: tableName,
        status,
        approved_at: status === 'approved' ? Date.now() : null,
        created_at: sqlDateTime(),
        updated_at: sqlDateTime(),
      }
      for (const key of ['author_name', 'author_email', 'user_id'] as const) {
        if (comment[key] != null)
          values[key] = comment[key]
      }

      const written = await db
        .insertInto('commentables')
        .values(values)
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
        .orderBy('id', 'asc')
        .execute()
    },

    async pendingComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'pending')
        .selectAll()
        .orderBy('id', 'asc')
        .execute()
    },

    async rejectedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'rejected')
        .selectAll()
        .orderBy('id', 'asc')
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
