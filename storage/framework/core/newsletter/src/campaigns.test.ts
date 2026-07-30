import { describe, expect, test } from 'bun:test'
import { campaignCreateData, campaignUpdateData } from './campaigns'

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
})
