import { describe, expect, it } from 'bun:test'
import { buddyOptions } from '@stacksjs/cli'
import { authPruneActionOptions } from '../src/commands/auth-prune-options'

describe('auth prune action options', () => {
  it('preserves disabled cleanup classes across the subprocess boundary', () => {
    expect(buddyOptions(authPruneActionOptions({
      expired: false,
      revoked: true,
      days: 30,
    }))).toBe('--revoked --days 30 --no-expired')

    expect(buddyOptions(authPruneActionOptions({
      expired: true,
      revoked: false,
      days: 7,
    }))).toBe('--expired --days 7 --no-revoked')
  })
})
