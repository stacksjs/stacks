import { describe, expect, test } from 'bun:test'
import {
  campaignScheduleIso,
  validateCampaignDelivery,
} from './campaign-delivery'

const campaign = {
  type: 'email',
  status: 'draft',
  email_list_id: 7,
  subject: 'Product update',
  template: 'product-update',
}

describe('campaign delivery', () => {
  test('validates delivery readiness from persisted campaign state', () => {
    expect(validateCampaignDelivery(campaign, 'send', 24)).toBe('')
    expect(validateCampaignDelivery(campaign, 'send', 0))
      .toBe('The selected email list has no active subscribers.')
    expect(validateCampaignDelivery(campaign, 'send', 24, 'archived'))
      .toBe('Campaign delivery requires an active email list.')
    expect(validateCampaignDelivery({ ...campaign, status: 'sent' }, 'send', 24))
      .toBe('Campaigns in sent status cannot enter delivery.')
  })

  test('limits cancellation to queued or active delivery', () => {
    expect(validateCampaignDelivery({ ...campaign, status: 'scheduled' }, 'cancel')).toBe('')
    expect(validateCampaignDelivery({ ...campaign, status: 'sending' }, 'cancel')).toBe('')
    expect(validateCampaignDelivery(campaign, 'cancel'))
      .toBe('Only scheduled or sending campaigns can be cancelled.')
  })

  test('normalizes a future schedule to an ISO timestamp', () => {
    expect(campaignScheduleIso(
      '2030-01-01T09:00:00.000Z',
      new Date('2029-01-01T00:00:00.000Z'),
    )).toEqual({
      value: '2030-01-01T09:00:00.000Z',
      error: '',
    })
    expect(campaignScheduleIso(
      '2028-01-01T09:00:00.000Z',
      new Date('2029-01-01T00:00:00.000Z'),
    ).error).toBe('Campaign schedule time must be in the future.')
  })
})
