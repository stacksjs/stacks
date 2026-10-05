import { afterEach, describe, expect, test } from 'bun:test'

const { Schedule, schedule } = await import('../src/schedule')

// stacksjs/stacks#930 — schedule.notification() factory.

describe('Schedule.notification', () => {
  test('exposes a static factory', () => {
    expect(typeof Schedule.notification).toBe('function')
  })

  test('returns a chainable Schedule instance', () => {
    const job = Schedule.notification(
      { email: 'team@example.com' },
      { subject: 'Daily', body: 'Hello' },
      ['email'],
    )
    expect(job).toBeDefined()
    // Every cadence helper should be present on the returned chain
    expect(typeof (job as any).daily).toBe('function')
    expect(typeof (job as any).hourly).toBe('function')
    expect(typeof (job as any).everyMinute).toBe('function')
  })

  test('accepts the same signature shape as notify()', () => {
    // recipient + payload + channels + options — all four positional args
    expect(() =>
      Schedule.notification(
        { email: 'a@b.com', userId: 1 },
        { subject: 's', body: 't' },
        ['email', 'sms'],
        { ignorePreferences: true, category: 'system' },
      ),
    ).not.toThrow()
  })

  test('schedule singleton mirrors the static surface', () => {
    expect(typeof (schedule as any).notification).toBe('function')
  })
})

describe('Schedule.notification names and failures', () => {
  afterEach(async () => {
    await Schedule.gracefulShutdown()
  })

  const names = () => Schedule.listJobs().map(job => job.name).filter(name => name.startsWith('notification-'))

  test('two different notifications on one cadence are two tasks', async () => {
    Schedule.notification({ email: 'team@example.com' }, { subject: 'Team digest', body: '...' }).daily()
    Schedule.notification({ email: 'billing@example.com' }, { subject: 'Billing digest', body: '...' }).daily()
    await Promise.resolve()

    // Both used to be named `notification`, and the second was dropped as a duplicate.
    expect(names()).toHaveLength(2)
  })

  test('the same notification twice is one task, under a name every process agrees on', async () => {
    Schedule.notification({ email: 'team@example.com', userId: 1 }, { subject: 'Digest', body: '...' }, ['email']).daily()
    Schedule.notification({ userId: 1, email: 'team@example.com' }, { body: '...', subject: 'Digest' }, ['email']).daily()
    await Promise.resolve()

    expect(names()).toHaveLength(1)
    expect(names()[0]).toMatch(/^notification-[0-9a-f]{12}$/)
  })

  test('.withName() still names it', async () => {
    Schedule.notification({ email: 'team@example.com' }, { body: '...' }).daily().withName('team-digest')
    await Promise.resolve()

    expect(Schedule.listJobs().map(job => job.name)).toContain('team-digest')
  })

  test('a run fails when a channel does not deliver', async () => {
    const seen: Error[] = []
    // No address for the email channel, which notify() reports in its result
    // rather than throwing.
    Schedule.notification({ userId: 1 }, { body: 'hi' }, ['email'], { ignorePreferences: true })
      .daily()
      .withName('undeliverable')
      .withErrorHandler(error => seen.push(error))
    await Promise.resolve()

    await expect(Schedule.runNow('undeliverable')).rejects.toThrow('not delivered on 1 of 1 channel(s) - email: [notify] email channel requires recipient.email')
    expect(seen).toHaveLength(1)
  })

  test('a run with nothing to fail succeeds', async () => {
    Schedule.notification({ userId: 1 }, { body: 'hi' }, [], { ignorePreferences: true }).daily().withName('no-channels')
    await Promise.resolve()

    await Schedule.runNow('no-channels')
  })
})
