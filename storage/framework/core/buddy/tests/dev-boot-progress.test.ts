import { describe, expect, it } from 'bun:test'
import { DEV_BOOT_PROGRESS_EVERY_SECONDS, devBootProgressLine } from '../src/commands/dev'

/**
 * `buddy dev` prints nothing between its header and the ready banner. Warm, that
 * is a few seconds and the quiet is right. Slow, it was silence for as long as
 * the boot took, so a server still building looked exactly like a dead one, and
 * after 30s the banner announced "ready" whether or not the API had bound
 * (#3077).
 */
const api = [{ name: 'API', port: 3008 }]

describe('what a slow dev boot says while it waits', () => {
  it('says nothing on a warm boot', () => {
    expect(devBootProgressLine(0, api)).toBeNull()
    expect(devBootProgressLine(DEV_BOOT_PROGRESS_EVERY_SECONDS - 0.1, api)).toBeNull()
  })

  it('says nothing once everything it waited for has answered', () => {
    expect(devBootProgressLine(60, [])).toBeNull()
  })

  it('names how long and which server once the wait is long', () => {
    expect(devBootProgressLine(10.4, api)).toBe('still starting, 10s so far, waiting for the API on :3008')
  })

  it('points at --verbose once it may be dead rather than slow', () => {
    // A server that crashed under `bun --watch` stays up waiting for an edit,
    // so the count climbing is the only sign, and its output is hidden.
    expect(devBootProgressLine(30, api)).toContain('`./buddy dev --verbose` shows its output')
    expect(devBootProgressLine(20, api)).not.toContain('--verbose')
    // Already verbose: the output is on screen, so the hint would be noise.
    expect(devBootProgressLine(30, api, true)).toBe('still starting, 30s so far, waiting for the API on :3008')
  })
})
