import { describe, expect, test } from 'bun:test'
import {
  normalizeSocialPosts,
  socialPostWriteData,
  validateSocialPostSchedule,
} from './social-post-records'

const now = new Date('2026-07-29T12:00:00.000Z')

describe('social post records', () => {
  test('normalizes persisted engagement and User relationships', () => {
    const result = normalizeSocialPosts(
      [{
        id: 8,
        content: 'A persisted update',
        platform: 'linkedin',
        status: 'published',
        published_at: '2026-07-29 10:00:00',
        likes: 12,
        shares: 4,
        comments: 3,
        reach: 900,
        user_id: 2,
      }],
      [{ id: 2, name: 'Ada Lovelace', email: 'ada@example.com' }],
    )

    expect(result.records[0]).toMatchObject({
      id: '8',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      engagement: 19,
      reach: 900,
    })
    expect(result.summary).toEqual({
      total: 1,
      published: 1,
      scheduled: 0,
      drafts: 0,
      failed: 0,
      reach: 900,
      engagement: 19,
    })
  })

  test('maps schedule writes and rejects non-future schedules', () => {
    const valid = socialPostWriteData({
      content: 'Schedule me',
      platform: 'instagram',
      status: 'scheduled',
      scheduledAt: '2026-07-30 12:00:00',
      userId: 4,
    }, now)
    expect(valid).toMatchObject({
      content: 'Schedule me',
      platform: 'instagram',
      status: 'scheduled',
      scheduled_at: '2026-07-30 12:00:00',
      user_id: 4,
    })
    expect(validateSocialPostSchedule(valid, now)).toBe('')

    const stale = socialPostWriteData({
      content: 'Too late',
      platform: 'twitter',
      status: 'scheduled',
      scheduledAt: '2026-07-28 12:00:00',
    }, now)
    expect(validateSocialPostSchedule(stale, now)).toBe('Schedule time must be in the future.')
  })
})
