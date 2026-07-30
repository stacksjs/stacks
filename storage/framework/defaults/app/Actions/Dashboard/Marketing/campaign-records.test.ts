import { describe, expect, test } from 'bun:test'
import {
  campaignWriteData,
  normalizeCampaigns,
  validateCampaignWriteData,
} from './campaign-records'

describe('campaign records', () => {
  test('uses real list membership and delivery aggregates', () => {
    const result = normalizeCampaigns(
      [{
        id: 3,
        name: 'Release',
        type: 'email',
        status: 'sent',
        email_list_id: 7,
        sent_count: 20,
        currency: 'USD',
      }],
      [{ id: 7, name: 'Product news', status: 'active' }],
      [{ email_list_id: 7, count: 42 }],
      [
        { campaign_id: 3, status: 'sent', count: 18 },
        { campaign_id: 3, status: 'failed', count: 2 },
      ],
      [{ campaign_id: 3, count: 9 }],
      [{ campaign_id: 3, count: 3 }],
    )

    expect(result.records[0]).toMatchObject({
      emailListName: 'Product news',
      audienceSize: 42,
      sentCount: 18,
      failedCount: 2,
      openedCount: 9,
      clickedCount: 3,
      openRate: 50,
    })
    expect(result.summary).toMatchObject({
      total: 1,
      sent: 1,
      recipients: 18,
      failedDeliveries: 2,
    })
  })

  test('maps dashboard input and validates email campaign requirements', () => {
    const data = campaignWriteData({
      name: 'Product release',
      type: 'email',
      status: 'scheduled',
      subject: 'Release notes',
      template: 'product-update',
      emailListId: '4',
      scheduledAt: '2030-01-01 09:00:00',
      fromName: 'Product team',
      fromAddress: 'product@stacksjs.org',
      currency: 'usd',
    })

    expect(data).toMatchObject({
      email_list_id: 4,
      scheduled_at: '2030-01-01 09:00:00',
      from_name: 'Product team',
      from_address: 'product@stacksjs.org',
      currency: 'USD',
    })
    expect(validateCampaignWriteData(data, new Date('2029-01-01T00:00:00'))).toBe('')
    expect(validateCampaignWriteData(
      { ...data, email_list_id: null },
      new Date('2029-01-01T00:00:00'),
    )).toBe('Email campaigns require an email list.')
  })
})
