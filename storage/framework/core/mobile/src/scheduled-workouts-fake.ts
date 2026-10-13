/**
 * A stand-in for Craft's `craft.scheduledWorkouts`, for tests and for driving
 * an app without an Apple Watch. It answers the way the iOS shell does: the
 * same codes (UNSUPPORTED, NOT_AUTHORIZED, INVALID_ARGUMENT, LIMIT_REACHED),
 * ids lowercase, the same id on another day moved, on the same day left alone.
 * WorkoutKit's own refusals of a goal or an alert for an activity are not
 * modelled; pass `refuse` to answer one.
 *
 * ```ts
 * const watch = createScheduledWorkoutsFake({ authorization: 'authorized' })
 * globalThis.window = { craft: watch.craft } // then scheduledWorkouts.* talks to it
 * ```
 *
 * On a phone simulator, the shell has its own stand-in instead: set the app's
 * `CraftFakeWorkoutScheduler` default (`xcrun simctl spawn <device> defaults
 * write <bundle id> CraftFakeWorkoutScheduler -bool YES`).
 */
import type { AppleWorkoutPlan, ScheduledWorkout, ScheduledWorkoutsAuthorization } from './scheduled-workouts'

export interface ScheduledWorkoutsFakeOptions {
  /** False plays an iPhone that cannot schedule (below iOS 17). */
  supported?: boolean
  /** The answer before anyone asks; `notDetermined` by default. */
  authorization?: ScheduledWorkoutsAuthorization
  /** What the person picks when asked; `authorized` by default. */
  grant?: 'authorized' | 'denied'
  /** How many plans the watch holds (WorkoutKit's maxAllowedScheduledWorkoutCount). */
  maxCount?: number
  /** A message to reject a plan with (as WorkoutKit refusing its goal would), or null to keep it. */
  refuse?: (plan: AppleWorkoutPlan) => string | null | undefined
  /** Alerts to report as dropped for a plan. */
  dropAlerts?: (plan: AppleWorkoutPlan) => string[]
}

export interface ScheduledWorkoutsFake {
  /** The `craft.scheduledWorkouts` object. */
  readonly bridge: Record<ScheduledWorkoutsMethod, (...args: any[]) => Promise<unknown>>
  /** A `window.craft` that has it: iOS, with the capability on. */
  readonly craft: { platform: 'ios', capabilities: { scheduledWorkouts: true }, scheduledWorkouts: ScheduledWorkoutsFake['bridge'] }
  /** What the watch holds now. */
  readonly scheduled: ScheduledWorkout[]
  /** Each call by method name, in order. */
  readonly calls: string[]
  authorization: ScheduledWorkoutsAuthorization
}

type ScheduledWorkoutsMethod = 'isSupported' | 'authorization' | 'requestAuthorization' | 'list' | 'schedule' | 'remove' | 'removeAll'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The activities Craft's shell knows by name (HKWorkoutActivityType cases). */
export const SCHEDULED_WORKOUT_ACTIVITIES: readonly string[] = [
  'running', 'cycling', 'swimming', 'walking', 'hiking', 'traditionalStrengthTraining', 'functionalStrengthTraining',
  'rowing', 'yoga', 'flexibility', 'crossTraining', 'elliptical', 'highIntensityIntervalTraining', 'other',
  'coreTraining', 'mixedCardio', 'stairClimbing', 'stairs', 'stepTraining', 'pilates', 'cardioDance', 'kickboxing',
  'boxing', 'jumpRope', 'cooldown', 'crossCountrySkiing', 'paddleSports', 'handCycling', 'wheelchairRunPace', 'wheelchairWalkPace',
]

function failure(message: string, code: string): Error {
  return Object.assign(new Error(message), { code })
}

function realDay(date: unknown): boolean {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function wholeIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function createScheduledWorkoutsFake(options: ScheduledWorkoutsFakeOptions = {}): ScheduledWorkoutsFake {
  const supported = options.supported !== false
  const maxCount = options.maxCount ?? 15
  const scheduled: ScheduledWorkout[] = []
  const calls: string[] = []
  const state = { authorization: (supported ? options.authorization ?? 'notDetermined' : 'unsupported') as ScheduledWorkoutsAuthorization }

  const allowed = (): void => {
    if (!supported) throw failure('unsupported', 'UNSUPPORTED')
    if (state.authorization !== 'authorized') throw failure('Scheduling workouts on the Apple Watch has not been allowed', 'NOT_AUTHORIZED')
  }

  const bridge: ScheduledWorkoutsFake['bridge'] = {
    isSupported: async () => { calls.push('isSupported'); return supported },
    authorization: async () => { calls.push('authorization'); return state.authorization },
    requestAuthorization: async () => {
      calls.push('requestAuthorization')
      if (supported && state.authorization === 'notDetermined') state.authorization = options.grant ?? 'authorized'
      return state.authorization
    },
    list: async () => {
      calls.push('list')
      allowed()
      return scheduled.map(row => ({ ...row }))
    },
    schedule: async (plan: AppleWorkoutPlan) => {
      calls.push('schedule')
      allowed()
      if (!plan || typeof plan.id !== 'string' || !UUID.test(plan.id)) throw failure('A scheduled workout needs an id (a UUID)', 'INVALID_ARGUMENT')
      const hour = plan.hour ?? 7
      const minute = plan.minute ?? 0
      if (!realDay(plan.date) || !wholeIn(hour, 0, 23) || !wholeIn(minute, 0, 59))
        throw failure('A scheduled workout needs a date (\'YYYY-MM-DD\') and, when given, an hour 0-23 and a minute 0-59', 'INVALID_ARGUMENT')
      const activity = plan.workout?.activity
      if (!SCHEDULED_WORKOUT_ACTIVITIES.includes(activity)) throw failure(`WorkoutKit has no activity '${activity ?? ''}'`, 'INVALID_ARGUMENT')
      const refusal = options.refuse?.(plan)
      if (refusal) throw failure(refusal, 'UNSUPPORTED_GOAL')
      const id = plan.id.toLowerCase()
      const same = scheduled.filter(row => row.id === id)
      if (!same.some(row => row.date === plan.date && row.hour === hour && row.minute === minute)) {
        if (scheduled.length - same.length >= maxCount)
          throw failure(`The Apple Watch holds at most ${maxCount} scheduled workouts; remove one first`, 'LIMIT_REACHED')
        scheduled.splice(0, scheduled.length, ...scheduled.filter(row => row.id !== id))
        scheduled.push({ id, date: plan.date, hour, minute, complete: false })
      }
      const dropped = options.dropAlerts?.(plan) ?? []
      return dropped.length ? { id, droppedAlerts: dropped } : { id }
    },
    remove: async (id: string) => {
      calls.push('remove')
      allowed()
      if (typeof id !== 'string' || !UUID.test(id)) throw failure('remove needs a plan id (a UUID)', 'INVALID_ARGUMENT')
      const before = scheduled.length
      scheduled.splice(0, scheduled.length, ...scheduled.filter(row => row.id !== id.toLowerCase()))
      return scheduled.length < before
    },
    removeAll: async () => {
      calls.push('removeAll')
      allowed()
      return scheduled.splice(0).length
    },
  }

  return {
    bridge,
    craft: { platform: 'ios', capabilities: { scheduledWorkouts: true }, scheduledWorkouts: bridge },
    scheduled,
    calls,
    get authorization() { return state.authorization },
    set authorization(value: ScheduledWorkoutsAuthorization) { state.authorization = value },
  }
}
