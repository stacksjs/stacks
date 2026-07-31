import { describe, expect, test } from 'bun:test'
import { buildCampaignAnalytics } from './campaign-analytics'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('campaign analytics', () => {
  test('derives delivery counts from recorded campaign rates', () => {
    const result = buildCampaignAnalytics([
      {
        id: '1',
        name: 'Native launch',
        type: 'email',
        status: 'sent',
        audienceSize: 1200,
        sentCount: 1000,
        openRate: 40,
        clickRate: 10,
        conversionRate: 2,
        budget: 500,
        spent: 350,
        currency: 'USD',
        createdAt: '2026-07-29T10:00:00.000Z',
      },
    ], 'day', now)

    expect(result.overview).toEqual({
      campaigns: 1,
      audience: 1200,
      sent: 1000,
      opens: 400,
      clicks: 100,
      conversions: 20,
      openRate: 40,
      clickRate: 10,
      conversionRate: 2,
    })
    expect(result.spendByCurrency).toEqual([{ currency: 'USD', budget: 500, spent: 350, campaigns: 1 }])
  })

  test('keeps channel spend separated by currency', () => {
    const shared = {
      type: 'social',
      status: 'active',
      audienceSize: 100,
      sentCount: 50,
      openRate: 0,
      clickRate: 4,
      conversionRate: 1,
      budget: 100,
      spent: 50,
      createdAt: '2026-07-29T10:00:00.000Z',
    }
    const result = buildCampaignAnalytics([
      { ...shared, id: '1', name: 'US social', currency: 'USD' },
      { ...shared, id: '2', name: 'EU social', currency: 'EUR' },
    ], 'day', now)

    expect(result.channels.map(channel => `${channel.name}:${channel.currency}`)).toEqual(['Social:EUR', 'Social:USD'])
  })

  test('preserves unrecorded campaign metrics instead of reporting zeroes', () => {
    const result = buildCampaignAnalytics([
      {
        id: '1',
        name: 'Draft newsletter',
        type: 'email',
        status: 'draft',
        audienceSize: null,
        sentCount: 0,
        openRate: null,
        clickRate: null,
        conversionRate: null,
        budget: null,
        spent: null,
        currency: 'USD',
        createdAt: '2026-07-29T10:00:00.000Z',
      },
    ], 'day', now)

    expect(result.overview).toMatchObject({
      audience: null,
      sent: 0,
      opens: 0,
      clicks: 0,
      conversions: 0,
      openRate: null,
      clickRate: null,
      conversionRate: null,
    })
    expect(result.spendByCurrency).toEqual([{
      currency: 'USD',
      budget: null,
      spent: null,
      campaigns: 1,
    }])
  })
})
