import { describe, expect, test } from 'bun:test'
import { advanceSequence, isQuietTime, nextSendableTime, sequenceTimeline } from '../src/sequences'

const berlin = { start: '21:00', end: '08:00', timeZone: 'Europe/Berlin' }
const steps = [
  { type: 'email', name: 'welcome' },
  { type: 'wait', minutes: 2 * 24 * 60 },
  { type: 'sms', name: 'nudge' },
  { type: 'task', name: 'call' },
  { type: 'wait', minutes: 0 },
  { type: 'email', name: 'last' },
]

describe('quiet hours', () => {
  test('an overnight window covers the evening and the early morning, in the zone given', () => {
    // 19:30 UTC is 21:30 in Berlin in summer (CEST, +2).
    expect(isQuietTime(new Date('2026-07-01T19:30:00Z'), berlin)).toBe(true)
    // 05:59 UTC is 07:59 in Berlin.
    expect(isQuietTime(new Date('2026-07-01T05:59:00Z'), berlin)).toBe(true)
    // 06:00 UTC is 08:00: the window has ended.
    expect(isQuietTime(new Date('2026-07-01T06:00:00Z'), berlin)).toBe(false)
    expect(isQuietTime(new Date('2026-07-01T12:00:00Z'), berlin)).toBe(false)
  })

  test('a daytime window, an empty window and no window', () => {
    const lunch = { start: '12:00', end: '13:00', timeZone: 'UTC' }
    expect(isQuietTime(new Date('2026-07-01T12:30:00Z'), lunch)).toBe(true)
    expect(isQuietTime(new Date('2026-07-01T13:00:00Z'), lunch)).toBe(false)
    expect(isQuietTime(new Date('2026-07-01T12:30:00Z'), { ...lunch, end: '12:00' })).toBe(false)
    expect(isQuietTime(new Date('2026-07-01T12:30:00Z'), null)).toBe(false)
  })

  test('rejects a time that is not HH:mm', () => {
    expect(() => isQuietTime(new Date(), { ...berlin, start: '9pm' })).toThrow('21:00')
  })

  test('the next sendable time is the end of the window, the next morning when it started the evening before', () => {
    expect(nextSendableTime(new Date('2026-07-01T19:30:00Z'), berlin).toISOString()).toBe('2026-07-02T06:00:00.000Z')
    expect(nextSendableTime(new Date('2026-07-01T03:00:00Z'), berlin).toISOString()).toBe('2026-07-01T06:00:00.000Z')
    const midday = new Date('2026-07-01T12:00:00Z')
    expect(nextSendableTime(midday, berlin)).toBe(midday)
  })

  test('follows daylight saving: 08:00 in Berlin is 07:00 UTC in winter', () => {
    expect(nextSendableTime(new Date('2026-12-01T22:00:00Z'), berlin).toISOString()).toBe('2026-12-02T07:00:00.000Z')
    // The night the clocks go back (25 October 2026).
    expect(nextSendableTime(new Date('2026-10-24T21:00:00Z'), berlin).toISOString()).toBe('2026-10-25T07:00:00.000Z')
  })
})

describe('advanceSequence', () => {
  const noon = new Date('2026-07-01T10:00:00Z')

  test('runs steps up to the first wait and says when to continue', () => {
    const advance = advanceSequence(steps, 0, noon)
    expect(advance.run.map(item => item.index)).toEqual([0])
    expect(advance.next).toEqual({ index: 2, at: new Date('2026-07-03T10:00:00Z') })
  })

  test('passes over a zero wait and finishes when the steps run out', () => {
    const advance = advanceSequence(steps, 2, noon)
    expect(advance.run.map(item => item.step.name)).toEqual(['nudge', 'call', 'last'])
    expect(advance.next).toBeNull()
  })

  test('holds a message in quiet hours, and lets a step that reaches no phone through', () => {
    const night = new Date('2026-07-01T20:00:00Z')
    const held = advanceSequence(steps, 2, night, { quietHours: berlin })
    expect(held.run).toEqual([])
    expect(held.next).toEqual({ index: 2, at: new Date('2026-07-02T06:00:00Z') })

    const tasksThrough = advanceSequence(steps, 2, night, { quietHours: berlin, respectsQuietHours: step => step.type !== 'task' && step.type !== 'wait' })
    expect(tasksThrough.run).toEqual([])
    const fromTask = advanceSequence(steps, 3, night, { quietHours: berlin, respectsQuietHours: step => step.type !== 'task' && step.type !== 'wait' })
    expect(fromTask.run.map(item => item.step.name)).toEqual(['call'])
    expect(fromTask.next).toEqual({ index: 5, at: new Date('2026-07-02T06:00:00Z') })
  })

  test('rejects a bad position and a negative wait', () => {
    expect(() => advanceSequence(steps, -1, noon)).toThrow()
    expect(() => advanceSequence([{ type: 'wait', minutes: -5 }], 0, noon)).toThrow()
  })
})

describe('sequenceTimeline', () => {
  test('lays every step out in time, moving messages out of quiet hours', () => {
    // Starts at 22:00 Berlin: the welcome waits for 08:00, the wait counts from then.
    const timeline = sequenceTimeline(steps, new Date('2026-07-01T20:00:00Z'), { quietHours: berlin })
    expect(timeline.map(item => [item.step.name, item.at.toISOString()])).toEqual([
      ['welcome', '2026-07-02T06:00:00.000Z'],
      ['nudge', '2026-07-04T06:00:00.000Z'],
      ['call', '2026-07-04T06:00:00.000Z'],
      ['last', '2026-07-04T06:00:00.000Z'],
    ])
  })

  test('an empty sequence has an empty timeline', () => {
    expect(sequenceTimeline([], new Date())).toEqual([])
  })
})
