import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, onUnknownSubcommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import {
  FEEDBACK_BOARD_COLUMNS,
  FEEDBACK_BOARD_NAME,
  feedbackSubmitUrl,
  type FeedbackTokenStatus,
  parseBoardRef,
  parseExpiryDays,
  parseRowRef,
  renderFeedbackTokens,
  type RowRef,
  toStoredTimestamp,
} from '../feedback-links'

/**
 * `buddy feedback:invite` / `feedback:tokens` / `feedback:revoke`.
 *
 * An external reviewer files feedback through a revocable link and never gets
 * an account (stacksjs/stacks#2872). Minting one means hashing a 256-bit
 * token and binding it to a board, so without these commands the only way to
 * use the feature at all was to insert the row by hand - and a wrong hash
 * fails as "this feedback link is not valid", which looks like a bug in the
 * intake path rather than a typo.
 *
 * The raw token exists for exactly as long as `feedback:invite` runs. It is
 * printed once, to stdout rather than through `log` (which writes to a file
 * in production), and only its SHA-256 is stored - so a lost link is
 * re-issued rather than looked up.
 */

interface TokenRow {
  id: number
  label: string
  board_id: number | null
  revoked_at: string | null
  expires_at: string | null
  last_used_at: string | null
}

/**
 * The token module the intake action uses, through the same override chain.
 *
 * Loaded from the filesystem rather than imported, the way `user:add` loads
 * its model: an app that overrides the action's hashing has to mint tokens
 * its own action will accept, and a CLI that hashed differently would issue
 * links that are refused on arrival.
 */
async function loadFeedbackToken(): Promise<{
  mintFeedbackToken: () => { raw: string, hash: string }
  authorizeFeedbackToken: (row: unknown, now?: Date) => { ok: true, boardId: number } | { ok: false, reason: string }
}> {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  const relative = 'Actions/Dashboard/Feedback/feedback-token.ts'
  const candidates = [
    join(process.cwd(), 'app', relative),
    join(process.cwd(), 'storage/framework/defaults/app', relative),
    join(process.cwd(), 'node_modules/@stacksjs/defaults/app', relative),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate))
      continue
    const loaded = await import(candidate)
    if (typeof loaded?.mintFeedbackToken === 'function')
      return loaded
  }

  await log.error(`Could not find ${relative}. Looked in app/, the framework defaults and @stacksjs/defaults.`)
  await log.flush()
  process.exit(ExitCode.FatalError)
}

/** The app URL, read after the config overrides have merged. */
async function appUrl(): Promise<string | undefined> {
  // Read before `overridesReady` and `config.app.url` answers with the
  // framework default, which is derived from package.json and ignores
  // APP_URL - so a deployed app would be handed a localhost link
  // (stacksjs/stacks#2333).
  const { config, overridesReady } = await import('@stacksjs/config')
  await overridesReady.catch(() => {})
  return (config as any)?.app?.url
}

async function database(): Promise<any> {
  const { db } = await import('@stacksjs/database/runtime')
  return db
}

/**
 * Report a missing table as the migration it is.
 *
 * `feedback_tokens` ships with the dashboard feature, so an app that has it
 * switched off, or has not migrated since, hits a driver error naming a table
 * the operator has never heard of.
 */
async function reportDatabaseError(err: unknown): Promise<never> {
  const message = err instanceof Error ? err.message : String(err)
  if (/feedback_tokens/.test(message) && /no such table|does not exist|doesn't exist/i.test(message)) {
    await log.error('There is no `feedback_tokens` table yet.')
    log.info('Run `buddy migrate` (the table ships with the dashboard feature).')
  }
  else {
    await log.error(message)
  }
  await log.flush()
  process.exit(ExitCode.FatalError)
}

/** The board a link files into, created only when asked for. */
async function resolveBoard(db: any, ref: RowRef, create: boolean): Promise<number> {
  const query = db.selectFrom('boards').select(['id', 'name'])
  const found = ref.kind === 'id'
    ? await query.where('id', '=', ref.id).executeTakeFirst()
    : await query.where('name', '=', ref.name).orderBy('id', 'asc').executeTakeFirst()

  if (found)
    return Number(found.id)

  if (ref.kind === 'id') {
    await log.error(`There is no board ${ref.id}.`)
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  if (!create) {
    await log.error(`There is no board called \`${ref.name}\`.`)
    log.info('Pass --create-board to make one, or --board <id> to pick an existing board.')
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  const position = await db.selectFrom('boards').select(['id']).execute()
  await db.insertInto('boards').values({
    name: ref.name,
    description: 'Feedback from external reviewers.',
    icon: 'bubble.left.and.text.bubble.right.fill',
    color: 'violet',
    position: position.length,
    archived: false,
  }).execute()

  const created = await db.selectFrom('boards').select(['id']).where('name', '=', ref.name).orderBy('id', 'desc').executeTakeFirst()
  const boardId = Number(created?.id)
  if (!Number.isInteger(boardId) || boardId <= 0) {
    await log.error(`Created the \`${ref.name}\` board but could not read its id back.`)
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  // Columns in the same breath as the board. The intake action files into the
  // first column by position, so a board without them accepts a valid token
  // and then reports the link as invalid for want of anywhere to put the card.
  for (const [index, name] of FEEDBACK_BOARD_COLUMNS.entries())
    await db.insertInto('board_columns').values({ board_id: boardId, name, position: index }).execute()

  log.success(`Created the \`${ref.name}\` board with ${FEEDBACK_BOARD_COLUMNS.length} columns`)
  return boardId
}

export function feedback(buddy: CLI): void {
  buddy
    .command('feedback:invite <label>', 'Mint a revocable link an external reviewer files feedback through')
    .option('--board <board>', `Board id or name to file into. Defaults to \`${FEEDBACK_BOARD_NAME}\`.`)
    .option('--expires <days>', 'Expire the link after this many days. Omitted, it lasts until revoked.')
    .option('--create-board', `Create the board, with columns, if it does not exist`, { default: false })
    .example('buddy feedback:invite Pawel')
    .example('buddy feedback:invite Pawel --expires 30 --create-board')
    .example('buddy feedback:invite "Design review" --board 3')
    .action(async (label: string, options: { board?: string, expires?: string, createBoard?: boolean }) => {
      const name = String(label || '').trim()
      if (!name || name.length > 120) {
        await log.error('A label of 1 to 120 characters is required. It is who the link is for, and it is how you revoke the right one.')
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const expiry = parseExpiryDays(options.expires, new Date())
      if (!expiry.ok) {
        await log.error(expiry.message)
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const url = await appUrl()
      if (!url?.trim()) {
        await log.error('No app URL configured, so there is no link to hand out. Set APP_URL or config.app.url.')
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const { mintFeedbackToken } = await loadFeedbackToken()
      const db = await database()

      try {
        const boardId = await resolveBoard(db, parseBoardRef(options.board), options.createBoard === true)
        const { raw, hash } = mintFeedbackToken()

        await db.insertInto('feedback_tokens').values({
          token: hash,
          label: name,
          board_id: boardId,
          expires_at: expiry.at ? toStoredTimestamp(expiry.at) : null,
        }).execute()

        // Read back by hash rather than trusting an insert id: the column is
        // unique, and the drivers disagree about what they report for an
        // insert.
        const row = await db.selectFrom('feedback_tokens').select(['id']).where('token', '=', hash).executeTakeFirst()

        // Straight to stdout. `log` writes to a file in production and this
        // line is the credential.
        process.stdout.write(`\n  ${feedbackSubmitUrl(url, raw)}\n\n`)
        log.info(`Link ${row?.id ?? '?'} for ${name}, filing into board ${boardId}${expiry.at ? `, expires ${toStoredTimestamp(expiry.at)} UTC` : ''}.`)
        log.info('That link is shown once; only its hash is stored. Revoke it with `buddy feedback:revoke`.')
      }
      catch (err) {
        await reportDatabaseError(err)
      }

      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('feedback:tokens', 'List the feedback links and whether they still work')
    .option('--board <board>', 'Only links filing into this board id or name')
    .example('buddy feedback:tokens')
    .example('buddy feedback:tokens --board Feedback')
    .action(async (options: { board?: string }) => {
      const { authorizeFeedbackToken } = await loadFeedbackToken()
      const db = await database()

      try {
        let query = db.selectFrom('feedback_tokens')
          .select(['id', 'label', 'board_id', 'revoked_at', 'expires_at', 'last_used_at'])

        if (options.board) {
          const ref = parseRowRef(options.board)
          if (!ref) {
            await log.error(`\`${options.board}\` is not a board id or name.`)
            await log.flush()
            process.exit(ExitCode.FatalError)
          }

          // The name is resolved to ids here rather than passed as a
          // subquery: this builder reads a query handed to `in` as a value
          // and matched nothing, so `--board Feedback` quietly listed no
          // links at all while `--board 1` listed them.
          let ids = [ref.kind === 'id' ? ref.id : 0]

          if (ref.kind === 'name') {
            // Names are not unique, so every board of that name counts.
            const boards = await db.selectFrom('boards').select(['id']).where('name', '=', ref.name).execute() as Array<{ id: number }>
            if (boards.length === 0) {
              await log.error(`There is no board called \`${ref.name}\`.`)
              await log.flush()
              process.exit(ExitCode.FatalError)
            }
            ids = boards.map(board => Number(board.id))
          }

          query = query.where('board_id', 'in', ids)
        }

        const rows = await query.orderBy('id', 'desc').execute() as TokenRow[]

        process.stdout.write(`${renderFeedbackTokens(rows.map((row) => {
          const verdict = authorizeFeedbackToken(row)
          return {
            id: Number(row.id),
            label: String(row.label ?? ''),
            boardId: Number(row.board_id ?? 0),
            // The same verdict the intake action reaches, so the listing
            // cannot call a link active that a submission would be refused on.
            status: (verdict.ok ? 'active' : verdict.reason) as FeedbackTokenStatus,
            lastUsedAt: row.last_used_at ?? null,
            expiresAt: row.expires_at ?? null,
          }
        }))}\n`)
      }
      catch (err) {
        await reportDatabaseError(err)
      }

      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('feedback:revoke <link>', 'Stop a feedback link, by id or by the label it was minted with')
    .example('buddy feedback:revoke 3')
    .example('buddy feedback:revoke Pawel')
    .action(async (link: string) => {
      const ref = parseRowRef(link)
      if (!ref) {
        await log.error('Name the link to revoke, by id or by label. `buddy feedback:tokens` lists them.')
        await log.flush()
        process.exit(ExitCode.FatalError)
      }

      const db = await database()

      try {
        const query = db.selectFrom('feedback_tokens').select(['id', 'label', 'revoked_at'])
        const matches = await (ref.kind === 'id'
          ? query.where('id', '=', ref.id)
          : query.where('label', '=', ref.name)).orderBy('id', 'asc').execute() as TokenRow[]

        if (matches.length === 0) {
          await log.error(ref.kind === 'id' ? `There is no feedback link ${ref.id}.` : `No feedback link is labelled \`${ref.name}\`.`)
          await log.flush()
          process.exit(ExitCode.FatalError)
        }

        const row = matches[0]!

        // Labels are deliberately not unique - the same reviewer gets a fresh
        // link when one expires - so an ambiguous one is refused rather than
        // resolved. Revoking the wrong link is silent until the reviewer says
        // the one they were using stopped working.
        if (matches.length > 1) {
          await log.error(`${matches.length} links are labelled \`${row.label}\`. Revoke one by id: ${matches.map(match => match.id).join(', ')}.`)
          await log.flush()
          process.exit(ExitCode.FatalError)
        }

        if (row.revoked_at) {
          log.info(`Link ${row.id} (${row.label}) was already revoked at ${row.revoked_at} UTC.`)
          await log.flush()
          process.exit(ExitCode.Success)
        }

        const at = toStoredTimestamp(new Date())
        await db.updateTable('feedback_tokens').set({ revoked_at: at }).where('id', '=', Number(row.id)).execute()
        log.success(`Revoked link ${row.id} (${row.label}). Submissions through it are refused from now on.`)
      }
      catch (err) {
        await reportDatabaseError(err)
      }

      await log.flush()
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'feedback')
}
