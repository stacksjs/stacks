import { expect, it } from 'bun:test'
import { pauseSessionClock, resumeSessionClock, sessionClockElapsed, startSessionClock } from '../src/session-clock'

it('excludes time paused across sleep and protects elapsed time from a backwards clock', () => {
  const clock = pauseSessionClock(startSessionClock(1000), 11000)
  expect(sessionClockElapsed(clock, 500000)).toBe(10)
  const resumed = resumeSessionClock(clock, 500000)
  expect(sessionClockElapsed(resumed, 505000)).toBe(15)
  expect(resumeSessionClock(clock, 9000).pausedMs).toBe(0)
  expect(sessionClockElapsed(resumed, Number.NaN)).toBe(0)
  expect(startSessionClock(Number.NaN).startedAt).toBeNull()
})
