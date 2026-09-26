import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy comments:*` — moderate the comments the `commentable` trait stores.
 *
 * The dashboard is not always there to do it: a site deployed without one
 * (a personal blog, a marketing site) still takes comments from readers, and
 * the only other way to remove a spam comment was a hand-written DELETE
 * against production. Run these on the box, e.g. through `buddy cloud --ssh`.
 *
 * Author emails are left out of the listing on purpose: it is the one column
 * a reader was told would not be shown, and a terminal gets screenshotted.
 */

const STATUSES = ['pending', 'approved', 'rejected'] as const

type Status = typeof STATUSES[number]

interface CommentRow {
  id: number
  title: string | null
  body: string | null
  status: string | null
  commentables_id: number
  commentables_type: string
  author_name?: string | null
  user_id?: number | null
  created_at?: string | null
}

/** One line of the body, short enough to scan in a terminal. */
export function excerpt(body: string | null | undefined, width = 60): string {
  const flat = String(body ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat
}

/** Who wrote it: the guest name, else the account, else nobody we know. */
export function commenter(row: Pick<CommentRow, 'author_name' | 'user_id'>): string {
  if (row.author_name)
    return row.author_name
  if (row.user_id)
    return `user #${row.user_id}`
  return 'anonymous'
}

export function formatCommentRow(row: CommentRow): string {
  const owner = `${row.commentables_type}#${row.commentables_id}`
  return `  ${String(row.id).padStart(5)}  ${String(row.status ?? '').padEnd(8)}  ${owner.padEnd(12)}  ${commenter(row).padEnd(18).slice(0, 18)}  ${excerpt(row.body)}`
}

/** The comment id from argv, or exit with the reason it is not one. */
async function commentId(raw: string): Promise<number> {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    await log.error(`\`${raw}\` is not a comment id. Find one with \`buddy comments:list\`.`)
    await log.flush()
    process.exit(ExitCode.FatalError)
  }
  return id
}

/** Exit unless the comment exists, so a typo'd id says so instead of "done". */
async function requireComment(id: number): Promise<CommentRow> {
  const { comments } = await import('@stacksjs/cms')
  const row = await comments.fetchCommentById(id) as CommentRow | undefined
  if (!row) {
    await log.error(`No comment with id ${id}.`)
    await log.flush()
    process.exit(ExitCode.FatalError)
  }
  return row
}

export function commentsCommands(buddy: CLI): void {
  buddy
    .command('comments:list', 'List reader comments, newest first')
    .option('--status <status>', `Only this status: ${STATUSES.join(', ')}`)
    .option('--type <type>', 'Only comments on this table, e.g. posts')
    .option('--limit <limit>', 'How many to show', { default: '25' })
    .example('buddy comments:list')
    .example('buddy comments:list --status pending --type posts')
    .action(async (options: { status?: string, type?: string, limit?: string }) => {
      if (options.status && !STATUSES.includes(options.status as Status)) {
        await log.error(`--status must be one of ${STATUSES.join(', ')}.`)
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const { db } = await import('@stacksjs/database/runtime')
      let query = db.selectFrom('commentables') as any
      if (options.status)
        query = query.where('status', '=', options.status)
      if (options.type)
        query = query.where('commentables_type', '=', options.type)

      const rows = await query
        .selectAll()
        .orderBy('id', 'desc')
        .limit(Number(options.limit) || 25)
        .execute() as CommentRow[]

      if (rows.length === 0) {
        log.info('No comments match.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      for (const row of rows)
        process.stdout.write(`${formatCommentRow(row)}\n`)

      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('comments:approve <id>', 'Publish a comment')
    .example('buddy comments:approve 12')
    .action(async (raw: string) => {
      const id = await commentId(raw)
      await requireComment(id)
      const { comments } = await import('@stacksjs/cms')
      await comments.approveComment(id)
      log.success(`Approved comment ${id}`)
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('comments:reject <id>', 'Hide a comment without deleting it')
    .example('buddy comments:reject 12')
    .action(async (raw: string) => {
      const id = await commentId(raw)
      await requireComment(id)
      const { comments } = await import('@stacksjs/cms')
      await comments.rejectComment(id)
      log.success(`Rejected comment ${id}`)
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('comments:delete <id>', 'Delete a comment for good')
    .example('buddy comments:delete 12')
    .action(async (raw: string) => {
      const id = await commentId(raw)
      const row = await requireComment(id)
      const { comments } = await import('@stacksjs/cms')
      await comments.deleteComment(id)
      log.success(`Deleted comment ${id} by ${commenter(row)}: "${excerpt(row.body, 40)}"`)
      await log.flush()
      process.exit(ExitCode.Success)
    })
}
