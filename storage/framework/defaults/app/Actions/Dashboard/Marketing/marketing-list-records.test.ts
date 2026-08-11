import { describe, expect, test } from 'bun:test'
import {
  marketingListWriteData,
  normalizeMarketingLists,
  slugifyMarketingList,
  validateMarketingListWriteData,
} from './marketing-list-records'

describe('marketing list records', () => {
  test('normalizes membership and campaign aggregates without trusting stale counters', () => {
    const result = normalizeMarketingLists(
      [{
        id: 4,
        name: 'Product News',
        slug: 'product-news',
        description: 'Product announcements',
        status: 'active',
        is_public: 1,
        double_opt_in: 1,
        subscriber_count: 99,
        created_at: '2026-07-01 12:00:00',
      }],
      [
        { email_list_id: 4, status: 'subscribed', count: 6 },
        { email_list_id: 4, status: 'pending', count: 2 },
        { email_list_id: 4, status: 'unsubscribed', count: 3 },
        { email_list_id: 4, status: 'bounced', count: 1 },
      ],
      [{ email_list_id: 4, count: 2 }],
      [{ email_list_id: 4, count: 3, last_sent_at: '2026-07-29 10:00:00' }],
    )

    expect(result.records[0]).toMatchObject({
      id: '4',
      subscriberCount: 8,
      activeCount: 6,
      unsubscribedCount: 3,
      bouncedCount: 1,
      storedSubscriberCount: 99,
      countDrift: true,
      campaignCount: 3,
      lastSentAt: '2026-07-29 10:00:00',
    })
    expect(result.summary).toEqual({
      total: 1,
      active: 1,
      subscribers: 8,
      newThisWeek: 2,
      campaigns: 3,
      counterDriftLists: 1,
    })
  })

  test('normalizes dashboard writes and derives a stable slug', () => {
    expect(slugifyMarketingList(' Product & Release News! ')).toBe('product-release-news')
    expect(marketingListWriteData({
      name: ' Product News ',
      slug: '',
      description: ' Weekly updates ',
      status: 'active',
      isPublic: true,
      doubleOptIn: false,
    })).toEqual({
      name: 'Product News',
      slug: 'product-news',
      description: 'Weekly updates',
      status: 'active',
      isPublic: 1,
      doubleOptIn: 0,
    })
  })

  test('rejects empty and oversized dashboard writes before model defaults apply', () => {
    expect(validateMarketingListWriteData(marketingListWriteData({})))
      .toBe('List name must be between 2 and 100 characters.')
    expect(validateMarketingListWriteData(marketingListWriteData({
      name: 'Product News',
      description: 'x'.repeat(501),
    }))).toBe('List description must be 500 characters or fewer.')
  })
})
