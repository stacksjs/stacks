import type { CreateCampaignInput, SendCampaignOptions } from './types'
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

export const campaigns = {
  async create(input: CreateCampaignInput) {
    const { Campaign } = await import('@stacksjs/orm') as any
    const emailListId = await resolveListId(input)

    return Campaign.create(campaignCreateData(input, emailListId))
  },

  async find(id: number) {
    const { Campaign } = await import('@stacksjs/orm') as any
    return Campaign.find(id)
  },

  async update(id: number, patch: Partial<CreateCampaignInput>) {
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
    if (campaign.status === 'sending' || campaign.status === 'sent')
      throw new Error(`[newsletter] Campaign ${id} already ${campaign.status}`)

    await campaign.update({ status: 'sending' })

    const { job } = await import('@stacksjs/queue')
    await job('SendCampaign', {
      campaignId: id,
      chunkSize: options.chunkSize ?? 50,
      dryRun: options.dryRun ?? false,
    })
      .onQueue('campaigns')
      .dispatch()

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

    const at = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt)
    const delaySeconds = Math.max(0, Math.floor((at.getTime() - Date.now()) / 1000))

    await campaign.update({
      status: delaySeconds === 0 ? 'sending' : 'scheduled',
      scheduled_at: at.toISOString(),
    })

    const { job } = await import('@stacksjs/queue')
    await job('SendCampaign', {
      campaignId: id,
      chunkSize: options.chunkSize ?? 50,
      dryRun: options.dryRun ?? false,
    })
      .onQueue('campaigns')
      .delay(delaySeconds)
      .dispatch()

    return { ok: true, campaignId: id, scheduledAt: at.toISOString() }
  },

  async cancel(id: number) {
    const campaign = await campaigns.find(id)
    if (!campaign)
      throw new Error(`[newsletter] Campaign ${id} not found`)
    if (campaign.status === 'sent')
      throw new Error(`[newsletter] Campaign ${id} already sent — cannot cancel`)
    return campaign.update({ status: 'cancelled' })
  },
}
