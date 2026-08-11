import { db } from '@stacksjs/database'
import { Campaign, EmailList } from '@stacksjs/orm'

export type CampaignDeliveryOperation = 'send' | 'schedule' | 'cancel'

export interface CampaignDeliveryContext {
  campaign: any | null
  activeMembers: number
  listStatus: string
}

export async function loadCampaignDeliveryContext(id: number): Promise<CampaignDeliveryContext> {
  const campaign = await Campaign.find(id)
  if (!campaign)
    return { campaign: null, activeMembers: 0, listStatus: '' }

  const listId = Number(campaign.get('email_list_id') || 0)
  const [list, memberRow] = listId
    ? await Promise.all([
        EmailList.find(listId),
        db
          .selectFrom('email_list_subscribers')
          .select(db.fn.count('id').as('count'))
          .where('email_list_id', '=', listId)
          .where('status', '=', 'subscribed')
          .executeTakeFirst(),
      ])
    : [null, null]

  return {
    campaign,
    activeMembers: Number(memberRow?.count || 0),
    listStatus: String(list?.get('status') || ''),
  }
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

export function validateCampaignDelivery(
  campaign: any,
  operation: CampaignDeliveryOperation,
  activeMembers = 0,
  listStatus = 'active',
): string {
  const type = text(value(campaign, 'type')).toLowerCase()
  const status = text(value(campaign, 'status')).toLowerCase()
  const listId = Number(value(campaign, 'email_list_id', 'emailListId'))

  if (type !== 'email')
    return 'Delivery actions are available only for email campaigns.'

  if (operation === 'cancel') {
    return ['scheduled', 'sending'].includes(status)
      ? ''
      : 'Only scheduled or sending campaigns can be cancelled.'
  }

  if (!['draft', 'scheduled', 'paused', 'failed'].includes(status))
    return `Campaigns in ${status || 'unknown'} status cannot enter delivery.`
  if (!Number.isInteger(listId) || listId < 1)
    return 'Email campaigns require an email list.'
  if (!text(value(campaign, 'subject')).trim())
    return 'Email campaigns require a subject.'
  if (!text(value(campaign, 'template')).trim())
    return 'Email campaigns require a template name or raw HTML.'
  if (listStatus !== 'active')
    return 'Campaign delivery requires an active email list.'
  if (activeMembers < 1)
    return 'The selected email list has no active subscribers.'
  return ''
}

export function campaignScheduleIso(input: unknown, now = new Date()): {
  value: string
  error: string
} {
  const date = new Date(text(input))
  if (!Number.isFinite(date.getTime()))
    return { value: '', error: 'Enter a valid campaign schedule time.' }
  if (date.getTime() <= now.getTime())
    return { value: '', error: 'Campaign schedule time must be in the future.' }
  return { value: date.toISOString(), error: '' }
}
