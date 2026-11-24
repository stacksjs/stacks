import { describe, expect, it } from 'bun:test'
import { countText, exceedsLimit, graphemes } from '../src/text'

/**
 * Every driver measured its limit in UTF-16 units, which no network does, so
 * a driver disagreed with the network in both directions.
 */

describe('graphemes', () => {
  it('counts an emoji built from several code points as one', () => {
    expect(graphemes('👩‍👩‍👧‍👦')).toBe(1)
    expect('👩‍👩‍👧‍👦'.length).toBeGreaterThan(1)
    expect(graphemes('🇩🇪')).toBe(1)
  })
})

describe('countText', () => {
  it('lets 200 emoji through on Bluesky, where they are 200 of 300', () => {
    const text = '🎉'.repeat(200)
    expect(text.length).toBe(400)
    expect(countText('bluesky', text)).toBe(200)
    expect(exceedsLimit('bluesky', text, 300)).toBe(false)
  })

  it('counts CJK double on X, so 150 Japanese characters are over 280', () => {
    const text = 'あ'.repeat(150)
    expect(text.length).toBe(150)
    expect(countText('twitter', text)).toBe(300)
    expect(exceedsLimit('twitter', text, 280)).toBe(true)
  })

  it('counts a link as 23 on X whatever its length', () => {
    const link = `https://example.com/${'a'.repeat(200)}`
    expect(countText('twitter', `see ${link}`)).toBe(4 + 23)
    // Trailing punctuation belongs to the sentence.
    expect(countText('twitter', 'see example.com.')).toBe(4 + 23 + 1)
  })

  it('counts an emoji as two on X', () => {
    expect(countText('twitter', '👍🏽')).toBe(2)
  })

  it('drops a mention\'s server on Mastodon and uses the instance\'s link length', () => {
    expect(countText('mastodon', '@glenn@example.social hi')).toBe('@glenn hi'.length)
    expect(countText('mastodon', 'https://example.com/long/path', { linkLength: 30 })).toBe(30)
    expect(countText('mastodon', 'https://example.com/long/path')).toBe(23)
  })

  it('counts Threads in graphemes and everything else in UTF-16 units', () => {
    expect(countText('threads', '🎉🎉')).toBe(2)
    expect(countText('linkedin', '🎉🎉')).toBe(4)
    expect(countText('instagram', '🎉🎉')).toBe(4)
  })

  it('treats a limit of 0 as none', () => {
    expect(exceedsLimit('linkedin', 'x'.repeat(10_000), 0)).toBe(false)
  })
})
