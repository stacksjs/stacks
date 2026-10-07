/**
 * Telling somebody that feedback arrived.
 *
 * A card filed through a feedback link lands on a board nobody is necessarily
 * looking at, so the feature's own brief asks for a notification "so feedback
 * is not found by accident" (stacksjs/stacks#2872).
 *
 * The fan-out mirrors `dashboard.ci.notifications`, down to the channel and
 * recipient shapes, rather than inventing a second convention for the same
 * job.
 *
 * Two deliberate differences from the CI notifier:
 *
 * - No cooldown. CI needs one because a flapping repo re-reports the same
 *   fact; every feedback card is a different person saying a different thing,
 *   so a cooldown would not de-duplicate anything, it would silently drop
 *   reports. The route's rate limit is what bounds the volume.
 * - A recipient is matched to the channels it can actually carry. `notify()`
 *   throws when the `email` channel gets a recipient with no address, and a
 *   throw per card is how a half-filled recipient list turns into no
 *   notifications at all.
 */

export type FeedbackNotificationChannel = 'email' | 'sms' | 'chat' | 'database'

export interface FeedbackNotificationRecipient {
  email?: string
  phone?: string
  userId?: number
}

export interface FeedbackNotificationSettings {
  enabled?: boolean
  channels?: FeedbackNotificationChannel[]
  recipients?: FeedbackNotificationRecipient[]
}

/** What each channel needs on a recipient before `notify()` will take it. */
const REQUIRES: Record<FeedbackNotificationChannel, keyof FeedbackNotificationRecipient | null> = {
  email: 'email',
  sms: 'phone',
  database: 'userId',
  // Already scoped to one Slack channel by its own env, so it carries no
  // recipient at all.
  chat: null,
}

export interface FeedbackFanoutTarget {
  recipient: FeedbackNotificationRecipient
  channels: FeedbackNotificationChannel[]
}

export type FeedbackFanout =
  | { send: false, reason: 'disabled' | 'no-channels' | 'no-recipients' }
  | { send: true, targets: FeedbackFanoutTarget[], unreachable: FeedbackNotificationChannel[] }

/**
 * Who gets told, and through what.
 *
 * Pure, so the awkward combinations can be read off a test rather than
 * discovered by filing feedback: a channel list with nobody who can receive
 * it, a recipient carrying the wrong contact field for the channel it was
 * listed under, `chat` alongside channels that do need a recipient.
 *
 * `unreachable` names the configured channels that reached nobody. Returned
 * rather than dropped: "configured and delivering nothing" and "not
 * configured" look identical from the outside, and only one of them is a
 * mistake.
 */
export function planFeedbackFanout(settings: FeedbackNotificationSettings | undefined): FeedbackFanout {
  if (!settings?.enabled)
    return { send: false, reason: 'disabled' }

  const channels = (settings.channels ?? ['chat']).filter(channel => channel in REQUIRES)
  if (channels.length === 0)
    return { send: false, reason: 'no-channels' }

  const targets: FeedbackFanoutTarget[] = []
  const reached = new Set<FeedbackNotificationChannel>()

  // `chat` goes out once with no recipient, however many people are listed:
  // every one of them would otherwise post the same message to the same
  // Slack channel.
  const broadcast = channels.filter(channel => REQUIRES[channel] === null)
  if (broadcast.length > 0) {
    targets.push({ recipient: {}, channels: broadcast })
    for (const channel of broadcast) reached.add(channel)
  }

  const addressed = channels.filter(channel => REQUIRES[channel] !== null)
  for (const recipient of settings.recipients ?? []) {
    const usable = addressed.filter((channel) => {
      const field = REQUIRES[channel]!
      const value = recipient[field]
      return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
    })
    if (usable.length === 0)
      continue
    targets.push({ recipient, channels: usable })
    for (const channel of usable) reached.add(channel)
  }

  if (targets.length === 0)
    return { send: false, reason: 'no-recipients' }

  return { send: true, targets, unreachable: channels.filter(channel => !reached.has(channel)) }
}

export interface FeedbackNotificationInput {
  boardId: number
  boardName?: string | null
  cardId: number
  title: string
  description?: string
  /** The link's label, so two reviewers' feedback can be told apart. */
  label: string
}

/** How long a quoted description runs before it is cut. */
const EXCERPT = 600

/**
 * The message itself.
 *
 * No URL. The board lives at `/kanban/{id}` of whatever origin serves the
 * dashboard, which is not always the app's own, and a notification carrying a
 * link that 404s for everybody is worse than one carrying a path.
 *
 * Never the token. The notification says which link a card came through by
 * its label, which is what an operator revokes by.
 */
export function feedbackNotification(input: FeedbackNotificationInput): {
  subject: string
  body: string
  data: Record<string, unknown>
} {
  const board = input.boardName?.trim() || `board ${input.boardId}`
  const description = input.description?.trim()

  const lines = [`${input.title}`, '']
  if (description)
    lines.push(description.length > EXCERPT ? `${description.slice(0, EXCERPT)}...` : description, '')
  lines.push(`Board: ${board} (/kanban/${input.boardId})`)
  lines.push(`Card: ${input.cardId}`)
  lines.push(`Through the link for: ${input.label}`)

  return {
    subject: `New feedback on ${board}: ${input.title}`,
    body: lines.join('\n'),
    data: {
      boardId: input.boardId,
      cardId: input.cardId,
      label: input.label,
    },
  }
}

/** The board's own name, for the subject line. Null if it cannot be read. */
async function boardName(boardId: number): Promise<string | null> {
  try {
    const { db } = await import('@stacksjs/database/runtime')
    const row = await (db as any).selectFrom('boards').select(['name']).where('id', '=', boardId).executeTakeFirst()
    const name = row?.name
    return typeof name === 'string' && name.trim() ? name : null
  }
  catch {
    // The message reads fine without it, and a notification is not worth
    // failing over a name.
    return null
  }
}

/**
 * Fan the notification out. Call as `void notifyFeedbackFiled(...)`.
 *
 * The card is already saved by the time this runs, so nothing here may fail
 * the submission: a reviewer must not be told their report did not go through
 * because an SMTP host was down. Every error is logged and swallowed, which is
 * the same contract `runCiFailureNotifier` has.
 */
export async function notifyFeedbackFiled(input: FeedbackNotificationInput): Promise<void> {
  try {
    const { dashboard } = await import('@stacksjs/config')
    const plan = planFeedbackFanout((dashboard as any)?.feedback?.notifications)
    if (!plan.send)
      return

    for (const channel of plan.unreachable)
      console.warn(`[feedback-notifier] the ${channel} channel is configured but nobody can receive it`)

    const { notify } = await import('@stacksjs/notifications')
    // Only now, because it is a query the submission does not need: the hot
    // path has already answered the reviewer, and an app with notifications
    // off never runs this at all.
    const payload = feedbackNotification({ ...input, boardName: input.boardName ?? await boardName(input.boardId) })

    for (const target of plan.targets) {
      try {
        // `ignorePreferences`, as the CI notifier does: this is an operator
        // alert on a surface they switched on, not a per-user subscription.
        await notify(target.recipient, payload, target.channels, { ignorePreferences: true })
      }
      catch (err) {
        console.warn(`[feedback-notifier] notify failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  catch (err) {
    console.warn(`[feedback-notifier] could not notify: ${err instanceof Error ? err.message : String(err)}`)
  }
}
