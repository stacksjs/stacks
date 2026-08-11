import { describe, expect, test } from 'bun:test'
import {
  campaignCreateData,
  campaignDeliveryDispatchKey,
  campaignDeliverySnapshot,
  campaignUpdateData,
  canQueueCampaignStatus,
  shouldRunScheduledCampaign,
} from './campaigns'

describe('newsletter campaigns', () => {
  test('maps campaign creation to database fillable columns', () => {
    expect(campaignCreateData({
      name: 'Product launch',
      description: 'Announce the release',
      subject: 'The release is ready',
      template: 'product-update',
      text: 'Read the release notes.',
      fromName: 'Stacks',
      fromAddress: 'news@stacksjs.org',
      emailListId: 4,
      scheduledAt: '2030-01-01 09:00:00',
    }, 4)).toEqual({
      name: 'Product launch',
      description: 'Announce the release',
      type: 'email',
      status: 'scheduled',
      subject: 'The release is ready',
      template: 'product-update',
      text: 'Read the release notes.',
      from_name: 'Stacks',
      from_address: 'news@stacksjs.org',
      email_list_id: 4,
      scheduled_at: '2030-01-01 09:00:00',
      sent_count: 0,
    })
  })

  test('maps only supplied update fields and can return a schedule to draft', () => {
    expect(campaignUpdateData({
      name: 'Updated launch',
      fromName: 'Product team',
      fromAddress: 'product@stacksjs.org',
      scheduledAt: '',
    }, 7)).toEqual({
      name: 'Updated launch',
      from_name: 'Product team',
      from_address: 'product@stacksjs.org',
      email_list_id: 7,
      scheduled_at: null,
      status: 'draft',
    })
  })

  test('rejects stale delayed jobs after a campaign is rescheduled or cancelled', () => {
    expect(shouldRunScheduledCampaign(
      { status: 'scheduled', scheduled_at: '2030-01-02T09:00:00.000Z' },
      '2030-01-01T09:00:00.000Z',
    )).toBe(false)
    expect(shouldRunScheduledCampaign(
      { status: 'cancelled', scheduled_at: '2030-01-01T09:00:00.000Z' },
      '2030-01-01T09:00:00.000Z',
    )).toBe(false)
    expect(shouldRunScheduledCampaign(
      { status: 'scheduled', scheduledAt: '2030-01-01 09:00:00' },
      '2030-01-01T09:00:00',
    )).toBe(true)
  })

  test('captures the complete compare-and-set delivery state', () => {
    expect(campaignDeliverySnapshot({
      status: 'scheduled',
      scheduled_at: '2030-01-01T09:00:00.000Z',
      updated_at: '2029-12-01T08:00:00.000',
    })).toEqual({
      status: 'scheduled',
      scheduledAt: '2030-01-01T09:00:00.000Z',
      updatedAt: '2029-12-01T08:00:00.000',
    })

    const model = {
      get(key: string) {
        return {
          status: 'failed',
          scheduledAt: null,
          updatedAt: '2029-12-02T08:00:00.000',
        }[key as 'status']
      },
    }
    expect(campaignDeliverySnapshot(model)).toEqual({
      status: 'failed',
      scheduledAt: null,
      updatedAt: '2029-12-02T08:00:00.000',
    })
  })

  test('uses one delivery key per claimed attempt and schedule', () => {
    expect(campaignDeliveryDispatchKey(12, 'immediate', 'attempt-a'))
      .toBe('newsletter:campaign:12:immediate:now:attempt-a')
    expect(campaignDeliveryDispatchKey(12, 'scheduled', 'attempt-b', '2030-01-01T09:00:00.000Z'))
      .toBe('newsletter:campaign:12:scheduled:2030-01-01T09:00:00.000Z:attempt-b')
  })

  test('queues only recoverable campaign states', () => {
    for (const status of ['draft', 'scheduled', 'paused', 'failed'])
      expect(canQueueCampaignStatus(status)).toBe(true)
    for (const status of ['sending', 'sent', 'cancelled', 'active', 'completed', 'archived'])
      expect(canQueueCampaignStatus(status)).toBe(false)
  })
})
