import { afterEach, describe, expect, it } from 'bun:test'
import type { AppleWorkoutPlan } from '../src'
import { mobile, normalizeScheduledWorkout, scheduledWorkouts } from '../src'
import { createScheduledWorkoutsFake } from '../src/scheduled-workouts-fake'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function install(craft?: Record<string, unknown>): void {
  const events = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      ...(craft ? { craft } : {}),
    },
  })
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete (globalThis as any).window
})

const plan: AppleWorkoutPlan = {
  id: '6F1C2B8E-5A7D-4C3E-9B1A-2D4E6F8A0B1C',
  date: '2026-10-20',
  hour: 6,
  minute: 30,
  workout: {
    activity: 'running',
    location: 'outdoor',
    displayName: '4 x 1 km',
    warmup: { goal: { type: 'time', seconds: 600 } },
    blocks: [{ iterations: 4, steps: [
      { purpose: 'work', step: { goal: { type: 'distance', meters: 1000 }, alert: { type: 'speed', min: 4.1, max: 4.4 } } },
      { purpose: 'recovery', step: { goal: { type: 'time', seconds: 120 } } },
    ] }],
  },
}
const id = plan.id.toLowerCase()

describe('scheduledWorkouts', () => {
  it('asks, schedules, lists and removes plans on the watch through the shell', async () => {
    const watch = createScheduledWorkoutsFake({ dropAlerts: () => ['block 1 step 1: speed alert, which WorkoutKit refuses for running (outdoor)'] })
    install(watch.craft)
    expect(scheduledWorkouts.isAvailable()).toBe(true)
    expect(scheduledWorkouts.supports('removeAll')).toBe(true)
    expect(await scheduledWorkouts.isSupported()).toBe(true)
    expect(await scheduledWorkouts.authorization()).toBe('notDetermined')
    await expect(scheduledWorkouts.list()).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })
    expect(await scheduledWorkouts.requestAuthorization()).toBe('authorized')
    expect(await scheduledWorkouts.list()).toEqual([])
    expect(await scheduledWorkouts.schedule(plan)).toEqual({ id, droppedAlerts: ['block 1 step 1: speed alert, which WorkoutKit refuses for running (outdoor)'] })
    expect(await scheduledWorkouts.list()).toEqual([{ id, date: '2026-10-20', hour: 6, minute: 30, complete: false }])
    // The same id on another day moves it; no time of day is 07:00.
    await scheduledWorkouts.schedule({ ...plan, date: '2026-10-21', hour: undefined, minute: undefined })
    expect(await scheduledWorkouts.list()).toEqual([{ id, date: '2026-10-21', hour: 7, minute: 0, complete: false }])
    expect(await scheduledWorkouts.remove(plan.id)).toBe(true)
    expect(await scheduledWorkouts.remove(plan.id)).toBe(false)
    await scheduledWorkouts.schedule(plan)
    expect(await scheduledWorkouts.removeAll()).toBe(1)
    expect(watch.scheduled).toEqual([])
    expect(mobile.scheduledWorkouts).toBe(scheduledWorkouts)
  })

  it('passes on what was refused, with its code', async () => {
    const watch = createScheduledWorkoutsFake({
      authorization: 'authorized',
      maxCount: 1,
      refuse: p => p.workout.activity === 'yoga' ? 'WorkoutKit refuses a distance goal for yoga (indoor) (block 1 step 1)' : null,
    })
    install(watch.craft)
    await expect(scheduledWorkouts.schedule({ ...plan, workout: { ...plan.workout, activity: 'curling' } }))
      .rejects.toMatchObject({ message: 'WorkoutKit has no activity \'curling\'', code: 'INVALID_ARGUMENT' })
    await expect(scheduledWorkouts.schedule({ ...plan, workout: { ...plan.workout, activity: 'yoga' } }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_GOAL' })
    await expect(scheduledWorkouts.schedule({ ...plan, date: '2026-02-30' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(scheduledWorkouts.schedule({ ...plan, id: 'session-12' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await expect(scheduledWorkouts.schedule(null as any)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    await scheduledWorkouts.schedule(plan)
    // The same plan on the same day again is left as it is, even when full.
    expect(await scheduledWorkouts.schedule(plan)).toEqual({ id })
    await expect(scheduledWorkouts.schedule({ ...plan, id: '0a1b2c3d-0000-4000-8000-000000000002' })).rejects.toMatchObject({ code: 'LIMIT_REACHED' })
  })

  it('is unsupported in a browser, on Android and in a build without the capability', async () => {
    const watch = createScheduledWorkoutsFake({ authorization: 'authorized' })
    for (const craft of [undefined, { platform: 'android', capabilities: {} }, { ...watch.craft, capabilities: { scheduledWorkouts: false } }]) {
      install(craft)
      expect(scheduledWorkouts.isAvailable()).toBe(false)
      expect(await scheduledWorkouts.isSupported()).toBe(false)
      for (const call of [
        () => scheduledWorkouts.authorization(),
        () => scheduledWorkouts.requestAuthorization(),
        () => scheduledWorkouts.list(),
        () => scheduledWorkouts.schedule(plan),
        () => scheduledWorkouts.remove(plan.id),
        () => scheduledWorkouts.removeAll(),
      ])
        await expect(call()).rejects.toMatchObject({ message: 'unsupported', code: 'UNSUPPORTED' })
    }
    expect(watch.calls).toEqual([])
  })

  it('answers unsupported on an iPhone that cannot schedule, and false when the phone cannot say', async () => {
    install(createScheduledWorkoutsFake({ supported: false }).craft)
    expect(await scheduledWorkouts.isSupported()).toBe(false)
    expect(await scheduledWorkouts.authorization()).toBe('unsupported')
    expect(await scheduledWorkouts.requestAuthorization()).toBe('unsupported')
    await expect(scheduledWorkouts.list()).rejects.toMatchObject({ code: 'UNSUPPORTED' })

    const watch = createScheduledWorkoutsFake()
    watch.bridge.isSupported = async () => { throw new Error('Craft bridge timed out: scheduledWorkouts') }
    install(watch.craft)
    expect(await scheduledWorkouts.isSupported()).toBe(false)
  })

  it('reads list rows defensively', () => {
    expect(normalizeScheduledWorkout({ id: 'ABC', date: '2026-10-20', complete: 1, hour: 'x' })).toEqual({ id: 'abc', date: '2026-10-20', complete: false })
    expect(normalizeScheduledWorkout({ id: 'abc', date: '20-10-2026' })).toBeNull()
    expect(normalizeScheduledWorkout(null)).toBeNull()
  })
})
