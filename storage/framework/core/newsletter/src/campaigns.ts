import type { CreateCampaignInput, SendCampaignOptions } from './types'
import { db, sqlDateTime } from '@stacksjs/database'
import { lists } from './lists'

/**
 * Campaign CRUD + dispatch.
 *
 * `sendNow()` and `schedule()` both end up dispatching the
 * `SendCampaignJob` queue handler — `schedule()` just adds a `delay()`
 * computed against the campaign's `scheduled_at`. The job is the one
 * source of truth for actually fanning out emails so that a manual
 * `sendNow()` from the dashboard and a cron-fired scheduled run go
 * through identical machinery.
 */

async function resolveListId(input: CreateCampaignInput): Promise<number> {
  if (input.emailListId)
    return input.emailListId
  if (input.emailListSlug) {
    const list = await lists.find(input.emailListSlug)
    if (!list)
      throw new Error(`[newsletter] List '${input.emailListSlug}' not found`)
    return list.id
  }
  throw new Error('[newsletter] Campaign requires emailListId or emailListSlug')
}

type CampaignWriteValue = string | number | null

interface ScheduledCampaignState {
  status?: unknown
  scheduled_at?: unknown
  scheduledAt?: unknown
}

interface CampaignDeliverySnapshot {
  status: string
  scheduledAt: string | null
  updatedAt: string | null
}

interface CampaignDeliveryTarget {
  status: string
  scheduledAt: string | null
  updatedAt: string
  attemptId: string
}

export class CampaignStateConflictError extends Error {
  constructor(id: number) {
    super(`[newsletter] Campaign ${id} changed before delivery could be queued`)
    this.name = 'CampaignStateConflictError'
  }
}

function campaignValue(campaign: any, snakeKey: string, camelKey: string): unknown {
  if (typeof campaign?.get === 'function') {
    const snakeValue = campaign.get(snakeKey)
    if (snakeValue !== undefined)
      return snakeValue
    return campaign.get(camelKey)
  }

  return campaign?.[snakeKey] ?? campaign?.[camelKey]
}

export function campaignDeliverySnapshot(campaign: any): CampaignDeliverySnapshot {
  const scheduledAt = campaignValue(campaign, 'scheduled_at', 'scheduledAt')
  const updatedAt = campaignValue(campaign, 'updated_at', 'updatedAt')
  return {
    status: String(campaignValue(campaign, 'status', 'status') || ''),
    scheduledAt: scheduledAt === null || scheduledAt === undefined || scheduledAt === ''
      ? null
      : String(scheduledAt),
    updatedAt: updatedAt === null || updatedAt === undefined || updatedAt === ''
      ? null
      : String(updatedAt),
  }
}

export function campaignDeliveryDispatchKey(
  id: number,
  mode: 'immediate' | 'scheduled',
  attempt: string,
  scheduledAt?: string,
): string {
  return `newsletter:campaign:${id}:${mode}:${scheduledAt || 'now'}:${attempt}`
}

export function canQueueCampaignStatus(status: unknown): boolean {
  return ['draft', 'scheduled', 'paused', 'failed'].includes(String(status || '').toLowerCase())
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result))
    return result.reduce((total, item) => total + affectedRows(item), 0)
  if (typeof result === 'number' || typeof result === 'bigint')
    return Number(result)

  const record = result as Record<string, unknown> | null | undefined
  const raw = record?.changes
    ?? record?.affectedRows
    ?? record?.numAffectedRows
    ?? record?.numUpdatedRows
  if (typeof raw === 'object' && raw !== null)
    return Number((raw as Record<string, unknown>).changes || 0)
  return Number(raw || 0)
}

function withScheduledAtMatch(query: any, scheduledAt: string | null): any {
  return scheduledAt === null
    ? query.whereNull('scheduled_at')
    : query.where('scheduled_at', '=', scheduledAt)
}

function withUpdatedAtMatch(query: any, updatedAt: string | null): any {
  return updatedAt === null
    ? query.whereNull('updated_at')
    : query.where('updated_at', '=', updatedAt)
}

async function transitionCampaignDelivery(
  id: number,
  expected: CampaignDeliverySnapshot,
  target: CampaignDeliveryTarget,
): Promise<void> {
  const query = withUpdatedAtMatch(
    withScheduledAtMatch(
      db
      .updateTable('campaigns')
      .set({
        status: target.status,
        scheduled_at: target.scheduledAt,
        updated_at: target.updatedAt,
      })
      .where('id', '=', id)
      .where('status', '=', expected.status),
      expected.scheduledAt,
    ),
    expected.updatedAt,
  )
  const result = await query.execute()
  if (affectedRows(result) !== 1)
    throw new CampaignStateConflictError(id)
}

async function restoreCampaignDelivery(
  id: number,
  expected: CampaignDeliveryTarget,
  restore: CampaignDeliverySnapshot,
): Promise<void> {
  const query = withScheduledAtMatch(
    db
      .updateTable('campaigns')
      .set({
        status: restore.status,
        scheduled_at: restore.scheduledAt,
        updated_at: sqlDateTime(),
      })
      .where('id', '=', id)
      .where('status', '=', expected.status)
      .where('updated_at', '=', expected.updatedAt),
    expected.scheduledAt,
  )
  await query.execute()
}

async function dispatchCampaign(
  id: number,
  target: CampaignDeliveryTarget,
  previous: CampaignDeliverySnapshot,
  options: SendCampaignOptions,
  scheduledAt?: string,
  delaySeconds = 0,
): Promise<void> {
  const { job } = await import('@stacksjs/queue')
  const mode = scheduledAt ? 'scheduled' : 'immediate'

  try {
    await job('SendCampaign', {
      campaignId: id,
      chunkSize: options.chunkSize ?? 50,
      dryRun: options.dryRun ?? false,
      ...(scheduledAt ? { scheduledAt } : {}),
    })
      .onQueue('campaigns')
      .delay(delaySeconds)
      .withIdempotencyKey(campaignDeliveryDispatchKey(id, mode, target.attemptId, scheduledAt))
      .dispatch()
  }
  catch (dispatchError) {
    try {
      await restoreCampaignDelivery(id, target, previous)
    }
    catch (restoreError) {
      throw new AggregateError(
        [dispatchError, restoreError],
        `[newsletter] Campaign ${id} could not be dispatched or restored`,
      )
    }
    throw dispatchError
  }
}

export function shouldRunScheduledCampaign(
  campaign: ScheduledCampaignState,
  expectedScheduledAt?: string,
): boolean {
  if (!expectedScheduledAt)
    return true
  if (String(campaign.status || '') !== 'scheduled')
    return false

  const currentScheduledAt = campaign.scheduled_at ?? campaign.scheduledAt
  const currentTime = new Date(String(currentScheduledAt || '')).getTime()
  const expectedTime = new Date(expectedScheduledAt).getTime()
  return Number.isFinite(currentTime)
    && Number.isFinite(expectedTime)
    && currentTime === expectedTime
}

export function campaignCreateData(
  input: CreateCampaignInput,
  emailListId: number,
): Record<string, CampaignWriteValue> {
  return {
    name: input.name,
    description: input.description ?? null,
    type: 'email',
    status: input.scheduledAt ? 'scheduled' : 'draft',
    subject: input.subject,
    template: input.template,
    text: input.text ?? null,
    from_name: input.fromName ?? null,
    from_address: input.fromAddress ?? null,
    email_list_id: emailListId,
    scheduled_at: input.scheduledAt ?? null,
    sent_count: 0,
  }
}

export function campaignUpdateData(
  patch: Partial<CreateCampaignInput>,
  emailListId?: number,
): Record<string, CampaignWriteValue> {
  const data: Record<string, CampaignWriteValue> = {}

  if (patch.name !== undefined)
    data.name = patch.name
  if (patch.description !== undefined)
    data.description = patch.description
  if (patch.subject !== undefined)
    data.subject = patch.subject
  if (patch.template !== undefined)
    data.template = patch.template
  if (patch.text !== undefined)
    data.text = patch.text
  if (patch.fromName !== undefined)
    data.from_name = patch.fromName
  if (patch.fromAddress !== undefined)
    data.from_address = patch.fromAddress
  if (emailListId !== undefined)
    data.email_list_id = emailListId
  if (patch.scheduledAt !== undefined) {
    data.scheduled_at = patch.scheduledAt || null
    data.status = patch.scheduledAt ? 'scheduled' : 'draft'
  }

  return data
}

/**
 * A campaign row as callers use it.
 *
 * Same reason as `EmailListRow`: the models arrive through
 * `await import(...) as any`, so there is nothing to infer a return type
 * from, and the published types said `Promise<void>` - which made
 * `campaigns.create()` useless to anyone who needed the new campaign's id in
 * order to send it.
 */
export interface CampaignRow {
  id: number
  name: string
  subject?: string | null
  status: string
  scheduled_at?: string | null
  sent_count?: number
  update: (data: Record<string, unknown>) => Promise<unknown>
  [key: string]: unknown
}

export const campaigns = {
  async create(input: CreateCampaignInput): Promise<CampaignRow> {
    const { Campaign } = await import('@stacksjs/orm') as any
    const emailListId = await resolveListId(input)

    return Campaign.create(campaignCreateData(input, emailListId))
  },

  async find(id: number): Promise<CampaignRow | undefined> {
    const { Campaign } = await import('@stacksjs/orm') as any
    return Campaign.find(id)
  },

  async update(id: number, patch: Partial<CreateCampaignInput>): Promise<unknown> {
    const campaign = await campaigns.find(id)
    if (!campaign)
      throw new Error(`[newsletter] Campaign ${id} not found`)
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled')
      throw new Error(`[newsletter] Cannot edit campaign in status '${campaign.status}'`)
    const shouldResolveList = patch.emailListId !== undefined || patch.emailListSlug !== undefined
    const emailListId = shouldResolveList
      ? await resolveListId(patch as CreateCampaignInput)
      : undefined
    return campaign.update(campaignUpdateData(patch, emailListId))
  },

  /** Move a draft straight into the queue. */
  async sendNow(id: number, options: SendCampaignOptions = {}) {
    const campaign = await campaigns.find(id)
    if (!campaign)
      throw new Error(`[newsletter] Campaign ${id} not found`)
    if (!canQueueCampaignStatus(campaign.status))
      throw new Error(`[newsletter] Campaign ${id} in status '${campaign.status}' cannot be queued`)

    const previous = campaignDeliverySnapshot(campaign)
    const target: CampaignDeliveryTarget = {
      status: 'sending',
      scheduledAt: previous.scheduledAt,
      updatedAt: sqlDateTime(),
      attemptId: crypto.randomUUID(),
    }

    await transitionCampaignDelivery(id, previous, target)
    await dispatchCampaign(id, target, previous, options)

    return { ok: true, campaignId: id }
  },

  /**
   * Persist a `scheduled_at` and dispatch the job with a delay computed
   * from now. If the time is in the past, falls back to immediate send.
   */
  async schedule(id: number, scheduledAt: Date | string, options: SendCampaignOptions = {}) {
    const campaign = await campaigns.find(id)
    if (!campaign)
      throw new Error(`[newsletter] Campaign ${id} not found`)
    if (!canQueueCampaignStatus(campaign.status))
      throw new Error(`[newsletter] Campaign ${id} in status '${campaign.status}' cannot be scheduled`)

    const at = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt)
    if (!Number.isFinite(at.getTime()))
      throw new Error('[newsletter] scheduledAt must be a valid date')

    const delaySeconds = Math.max(0, Math.floor((at.getTime() - Date.now()) / 1000))
    const scheduledAtIso = at.toISOString()

    const previous = campaignDeliverySnapshot(campaign)
    const target: CampaignDeliveryTarget = {
      status: delaySeconds === 0 ? 'sending' : 'scheduled',
      scheduledAt: scheduledAtIso,
      updatedAt: sqlDateTime(),
      attemptId: crypto.randomUUID(),
    }

    await transitionCampaignDelivery(id, previous, target)
    await dispatchCampaign(
      id,
      target,
      previous,
      options,
      delaySeconds > 0 ? scheduledAtIso : undefined,
      delaySeconds,
    )

    return { ok: true, campaignId: id, scheduledAt: scheduledAtIso }
  },

  async cancel(id: number) {
    const campaign = await campaigns.find(id)
    if (!campaign)
      throw new Error(`[newsletter] Campaign ${id} not found`)
    if (campaign.status === 'sent')
      throw new Error(`[newsletter] Campaign ${id} already sent. It cannot be cancelled`)
    const previous = campaignDeliverySnapshot(campaign)
    const target: CampaignDeliveryTarget = {
      status: 'cancelled',
      scheduledAt: previous.scheduledAt,
      updatedAt: sqlDateTime(),
      attemptId: crypto.randomUUID(),
    }
    await transitionCampaignDelivery(id, previous, target)
    return campaigns.find(id)
  },
}
