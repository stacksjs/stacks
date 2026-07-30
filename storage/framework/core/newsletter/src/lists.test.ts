import { describe, expect, test } from 'bun:test'
import { emailListCreateData } from './lists'

describe('newsletter lists', () => {
  test('maps facade input to the EmailList database fillable columns', () => {
    expect(emailListCreateData({
      name: 'Product News',
      description: 'Weekly product updates',
      isPublic: false,
      doubleOptIn: true,
    })).toEqual({
      name: 'Product News',
      slug: 'product-news',
      description: 'Weekly product updates',
      status: 'active',
      is_public: 0,
      double_opt_in: 1,
      subscriber_count: 0,
      active_count: 0,
      unsubscribed_count: 0,
      bounced_count: 0,
    })
  })
})
