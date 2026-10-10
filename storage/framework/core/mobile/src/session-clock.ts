/** Timestamp-based clocks keep elapsed time when the UI sleeps, excluding pauses. */
export interface SessionClock {
  startedAt: number | null
  pausedAt: number | null
  pausedMs: number
}

export function startSessionClock(now: number): SessionClock {
  return { startedAt: Number.isFinite(now) ? now : null, pausedAt: null, pausedMs: 0 }
}

export function pauseSessionClock(clock: SessionClock, now: number): SessionClock {
  return clock.startedAt === null || clock.pausedAt !== null || !Number.isFinite(now)
    ? clock
    : { ...clock, pausedAt: Math.max(clock.startedAt, now) }
}

export function resumeSessionClock(clock: SessionClock, now: number): SessionClock {
  return clock.pausedAt === null || !Number.isFinite(now)
    ? clock
    : { ...clock, pausedAt: null, pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt) }
}

export function sessionClockElapsed(clock: SessionClock, now: number): number {
  if (clock.startedAt === null) return 0
  const elapsed = ((clock.pausedAt ?? now) - clock.startedAt - clock.pausedMs) / 1000
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
}
