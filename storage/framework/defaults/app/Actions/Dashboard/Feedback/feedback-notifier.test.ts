import { describe, expect, it } from 'bun:test'
import { feedbackNotification, planFeedbackFanout } from './feedback-notifier'

/**
 * Who gets told when feedback arrives, and what they are told.
 *
 * Both halves are reachable only by filing a card through a live link against
 * configured channels, so left in the fan-out they would be tested by a
 * reviewer noticing that nobody heard from them.
 */

describe('planFeedbackFanout', () => {
  it('sends nothing while it is off', () => {
    expect(planFeedbackFanout(undefined)).toEqual({ send: false, reason: 'disabled' })
    expect(planFeedbackFanout({})).toEqual({ send: false, reason: 'disabled' })
    expect(planFeedbackFanout({ enabled: false, channels: ['chat'] })).toEqual({ send: false, reason: 'disabled' })
  })

  it('broadcasts chat once, with no recipient, however many are listed', () => {
    // Every listed person would otherwise post the same message into the same
    // Slack channel.
    const plan = planFeedbackFanout({
      enabled: true,
      channels: ['chat'],
      recipients: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
    })

    expect(plan).toEqual({ send: true, targets: [{ recipient: {}, channels: ['chat'] }], unreachable: [] })
  })

  it('defaults to chat when no channel is named', () => {
    const plan = planFeedbackFanout({ enabled: true })
    expect(plan.send).toBe(true)
    expect((plan as any).targets).toEqual([{ recipient: {}, channels: ['chat'] }])
  })

  it('offers a recipient only the channels whose contact field it carries', () => {
    // `notify()` throws when the email channel gets a recipient with no
    // address, and one throw per card is how a half-filled list becomes no
    // notifications at all.
    const plan = planFeedbackFanout({
      enabled: true,
      channels: ['email', 'sms', 'database'],
      recipients: [
        { email: 'chris@example.com' },
        { phone: '+15550000' },
        { userId: 7 },
        { email: 'both@example.com', phone: '+15551111' },
      ],
    })

    expect(plan.send).toBe(true)
    expect((plan as any).targets).toEqual([
      { recipient: { email: 'chris@example.com' }, channels: ['email'] },
      { recipient: { phone: '+15550000' }, channels: ['sms'] },
      { recipient: { userId: 7 }, channels: ['database'] },
      { recipient: { email: 'both@example.com', phone: '+15551111' }, channels: ['email', 'sms'] },
    ])
    expect((plan as any).unreachable).toEqual([])
  })

  it('leaves out a recipient whose contact field is blank', () => {
    const plan = planFeedbackFanout({
      enabled: true,
      channels: ['email'],
      recipients: [{ email: '   ' }, { email: 'real@example.com' }],
    })

    expect((plan as any).targets).toEqual([{ recipient: { email: 'real@example.com' }, channels: ['email'] }])
  })

  it('reports a channel configured with nobody able to receive it', () => {
    // "Configured and delivering nothing" and "not configured" look the same
    // from outside, and only one of them is a mistake.
    const plan = planFeedbackFanout({
      enabled: true,
      channels: ['chat', 'email'],
      recipients: [{ phone: '+15550000' }],
    })

    expect(plan.send).toBe(true)
    expect((plan as any).unreachable).toEqual(['email'])
  })

  it('refuses a channel list that can reach nobody at all', () => {
    expect(planFeedbackFanout({ enabled: true, channels: ['email'] }))
      .toEqual({ send: false, reason: 'no-recipients' })
    expect(planFeedbackFanout({ enabled: true, channels: ['email'], recipients: [{ phone: '+1' }] }))
      .toEqual({ send: false, reason: 'no-recipients' })
    expect(planFeedbackFanout({ enabled: true, channels: [] }))
      .toEqual({ send: false, reason: 'no-channels' })
  })

  it('drops a channel name it does not know rather than handing it to notify', () => {
    const plan = planFeedbackFanout({ enabled: true, channels: ['chat', 'carrier-pigeon' as any] })
    expect((plan as any).targets).toEqual([{ recipient: {}, channels: ['chat'] }])
  })
})

describe('feedbackNotification', () => {
  const base = {
    boardId: 4,
    cardId: 42,
    title: 'Checkout button does nothing on iPhone',
    label: 'Pawel',
  }

  it('names the board, the card and the link it came through', () => {
    const { subject, body, data } = feedbackNotification({ ...base, boardName: 'Feedback' })

    expect(subject).toBe('New feedback on Feedback: Checkout button does nothing on iPhone')
    expect(body).toContain('Board: Feedback (/kanban/4)')
    expect(body).toContain('Card: 42')
    expect(body).toContain('Through the link for: Pawel')
    expect(data).toEqual({ boardId: 4, cardId: 42, label: 'Pawel' })
  })

  it('falls back to the board id when the name could not be read', () => {
    for (const boardName of [undefined, null, '   ']) {
      const { subject, body } = feedbackNotification({ ...base, boardName })
      expect(subject).toContain('board 4')
      expect(body).toContain('Board: board 4 (/kanban/4)')
    }
  })

  it('quotes the description and cuts a long one', () => {
    const short = feedbackNotification({ ...base, description: 'Tapped it twice, nothing happened.' })
    expect(short.body).toContain('Tapped it twice, nothing happened.')

    const long = feedbackNotification({ ...base, description: 'x'.repeat(5000) })
    expect(long.body).toContain('...')
    // A 10k-character report must not become a 10k-character SMS.
    expect(long.body.length).toBeLessThan(1200)
  })

  it('carries no token, by having none to carry', () => {
    // The whole message is built from the board, the card and the label. An
    // operator revokes by label, so the raw token never needs to appear and
    // notifications are stored and forwarded by things nobody audits.
    const { subject, body, data } = feedbackNotification({ ...base, boardName: 'Feedback', description: 'd' })
    const everything = `${subject}\n${body}\n${JSON.stringify(data)}`
    expect(everything).not.toMatch(/[0-9a-f]{64}/)
  })
})
