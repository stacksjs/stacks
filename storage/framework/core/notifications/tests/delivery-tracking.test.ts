import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import { tracksChannel } from '../src/delivery'

/**
 * Delivery tracking is configurable (stacksjs/stacks#328).
 *
 * The interesting cases are the two defaults - on, and "no channel list means
 * every channel" - because both are the kind of thing a later refactor
 * quietly inverts, and an inverted tracking default is invisible until
 * somebody needs the record that was never written.
 */

const original = (config as any).notification?.tracking

afterEach(() => {
  ;(config as any).notification.tracking = original
})

function withTracking(tracking: unknown): void {
  ;(config as any).notification.tracking = tracking
}

describe('tracksChannel', () => {
  it('records every channel by default', () => {
    withTracking(undefined)
    for (const channel of ['email', 'sms', 'push', 'chat', 'database', 'broadcast'] as const)
      expect(tracksChannel(channel)).toBeTrue()
  })

  it('records nothing when disabled', () => {
    withTracking({ enabled: false })
    expect(tracksChannel('email')).toBeFalse()
    expect(tracksChannel('sms')).toBeFalse()
  })

  it('narrows to an explicit channel list', () => {
    withTracking({ enabled: true, channels: ['email', 'sms'] })
    expect(tracksChannel('email')).toBeTrue()
    expect(tracksChannel('sms')).toBeTrue()
    expect(tracksChannel('push')).toBeFalse()
  })

  it('treats an empty channel list as no restriction, not as none', () => {
    // `channels: []` reads as "no restriction" to the person writing it.
    // Interpreting it as an empty allowlist would silently stop recording
    // everything, which is the failure this exists to prevent.
    withTracking({ enabled: true, channels: [] })
    expect(tracksChannel('email')).toBeTrue()
  })

  it('lets `enabled: false` win over a channel list', () => {
    withTracking({ enabled: false, channels: ['email'] })
    expect(tracksChannel('email')).toBeFalse()
  })
})
