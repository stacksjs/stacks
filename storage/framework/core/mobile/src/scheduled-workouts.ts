/**
 * Structured workouts scheduled onto the paired Apple Watch.
 *
 * Craft's `craft.scheduledWorkouts` (an app built with
 * `capabilities.scheduledWorkouts`) hands each plan to WorkoutKit's
 * WorkoutScheduler (iOS 17+), and it appears in the watch's Workout app on its
 * day with its steps, goals and alerts. The same calls work on the page and on
 * a native stx screen. Everything is plain JSON in SI units.
 *
 * In a browser, on Android and in an app built without the capability,
 * `isSupported()` answers false and every other call rejects with
 * `unsupported` (code `UNSUPPORTED`).
 *
 * This talks to the bridge directly rather than through craft-native, so an
 * app that resolves an older craft-native still reaches a shell that has it.
 */
import { afterBridge, craftRoot } from './bridge'

export type ScheduledWorkoutsAuthorization = 'authorized' | 'denied' | 'notDetermined' | 'restricted' | 'unsupported'

export type AppleWorkoutGoal =
  | { type: 'open' }
  | { type: 'time', seconds: number }
  | { type: 'distance', meters: number }
  | { type: 'energy', kilocalories: number }

export type AppleWorkoutAlert =
  /** Beats per minute (HeartRateRangeAlert). */
  | { type: 'heartRate', min: number, max: number }
  | { type: 'heartRateZone', zone: number }
  /** Watts (PowerRangeAlert). */
  | { type: 'power', min: number, max: number }
  | { type: 'powerZone', zone: number }
  /** Metres per second, the current speed (SpeedRangeAlert); a pace range is sent as speed. */
  | { type: 'speed', min: number, max: number }
  /** Per minute (CadenceRangeAlert). */
  | { type: 'cadence', min: number, max: number }

export interface AppleWorkoutStep {
  goal: AppleWorkoutGoal
  /** Left out (the step kept, and named in `droppedAlerts`) when WorkoutKit refuses it for the activity. */
  alert?: AppleWorkoutAlert
  /** Shown on the watch from iOS 18; ignored on 17. At most 64 characters. */
  displayName?: string
}

export interface AppleIntervalBlock {
  /** 1 or more. */
  iterations: number
  steps: Array<{ purpose: 'work' | 'recovery', step: AppleWorkoutStep }>
}

export interface AppleCustomWorkout {
  /**
   * An HKWorkoutActivityType case name: 'running', 'cycling', 'swimming',
   * 'walking', 'hiking', 'traditionalStrengthTraining',
   * 'functionalStrengthTraining', 'rowing', 'yoga', 'flexibility',
   * 'crossTraining', 'elliptical', 'highIntensityIntervalTraining', 'other'...
   */
  activity: string
  location: 'indoor' | 'outdoor' | 'unknown'
  /** Swimming: with `location` 'unknown', a pool swim is scheduled indoor and open water outdoor. */
  swimmingLocation?: 'pool' | 'openWater'
  /** WorkoutKit takes no pool length; the watch asks for it when the swim starts. */
  poolLengthMeters?: number
  displayName: string
  warmup?: AppleWorkoutStep
  cooldown?: AppleWorkoutStep
  blocks: AppleIntervalBlock[]
}

export interface AppleWorkoutPlan {
  /** A UUID, the plan's identity on the watch (WorkoutPlan's id). */
  id: string
  /** The local calendar day, 'YYYY-MM-DD'. */
  date: string
  /** Local time of day; 07:00 when not given. */
  hour?: number
  minute?: number
  workout: AppleCustomWorkout
}

/** A plan on the watch's schedule. */
export interface ScheduledWorkout {
  /** Lowercase UUID. */
  id: string
  date: string
  hour?: number
  minute?: number
  /** The person has done it. */
  complete: boolean
}

export interface ScheduleWorkoutResult {
  /** Lowercase UUID. */
  id: string
  /** Alerts WorkoutKit refused and left out, each by where it was ("block 1 step 2: power alert, ..."). */
  droppedAlerts?: string[]
}

export type ScheduledWorkoutsMethod = 'isSupported' | 'authorization' | 'requestAuthorization' | 'list' | 'schedule' | 'remove' | 'removeAll'

export interface ScheduledWorkoutsApi {
  /** Whether this app build has the bridge at all; `isSupported()` says whether this phone can schedule. */
  isAvailable: () => boolean
  /** Whether this app build answers `method`. */
  supports: (method: ScheduledWorkoutsMethod) => boolean
  /** iOS 17 or later and WorkoutKit can schedule here. False everywhere else; never rejects. */
  isSupported: () => Promise<boolean>
  /** What the person allowed, without asking. */
  authorization: () => Promise<ScheduledWorkoutsAuthorization>
  /** iOS's prompt the first time, its remembered answer after that. Call it from the person's tap. */
  requestAuthorization: () => Promise<ScheduledWorkoutsAuthorization>
  /** Every plan on the watch's schedule. Rejects NOT_AUTHORIZED before access is allowed. */
  list: () => Promise<ScheduledWorkout[]>
  /**
   * Put a plan on the watch's schedule; the same id on another day moves it,
   * on the same day it is left as it is. Rejects with an Error whose message
   * names what was refused: an unknown or unschedulable activity, a goal
   * WorkoutKit refuses for it (UNSUPPORTED_GOAL), a malformed plan
   * (INVALID_ARGUMENT), a full schedule (LIMIT_REACHED), or a plan nothing
   * kept, as without a paired watch (NOT_SCHEDULED).
   */
  schedule: (plan: AppleWorkoutPlan) => Promise<ScheduleWorkoutResult>
  /** Removes every scheduled occurrence of the plan; true when there was one. */
  remove: (id: string) => Promise<boolean>
  /** Clears the schedule; how many plans it held. */
  removeAll: () => Promise<number>
}

const AUTHORIZATIONS: ScheduledWorkoutsAuthorization[] = ['authorized', 'denied', 'notDetermined', 'restricted', 'unsupported']

function native(): Record<string, any> | undefined {
  const craft = craftRoot()
  const bridge = craft?.scheduledWorkouts
  if (!bridge || typeof bridge !== 'object' || craft?.capabilities?.scheduledWorkouts !== true) return undefined
  return bridge
}

/** The rejection every call but `isSupported()` gets where nothing can schedule. */
export function scheduledWorkoutsUnsupported(): Error {
  return Object.assign(new Error('unsupported'), { code: 'UNSUPPORTED' })
}

function authorizationOf(value: unknown): ScheduledWorkoutsAuthorization {
  return AUTHORIZATIONS.includes(value as ScheduledWorkoutsAuthorization) ? value as ScheduledWorkoutsAuthorization : 'unsupported'
}

/** A row of `list()`, or null for one that is not a scheduled plan. */
export function normalizeScheduledWorkout(value: unknown): ScheduledWorkout | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null
  const out: ScheduledWorkout = { id: row.id.toLowerCase(), date: row.date, complete: row.complete === true }
  if (typeof row.hour === 'number' && Number.isFinite(row.hour)) out.hour = row.hour
  if (typeof row.minute === 'number' && Number.isFinite(row.minute)) out.minute = row.minute
  return out
}

function call<T>(method: ScheduledWorkoutsMethod, normalize: (value: unknown) => T, ...args: unknown[]): Promise<T> {
  return afterBridge(async () => {
    const bridge = native()
    if (typeof bridge?.[method] !== 'function') throw scheduledWorkoutsUnsupported()
    return normalize(await bridge[method](...args))
  })
}

export const scheduledWorkouts: ScheduledWorkoutsApi = {
  isAvailable: () => typeof native()?.isSupported === 'function',
  supports: method => typeof native()?.[method] === 'function',
  isSupported: () => afterBridge(async () => {
    const bridge = native()
    if (typeof bridge?.isSupported !== 'function') return false
    try {
      return await bridge.isSupported() === true
    }
    catch {
      return false
    }
  }),
  authorization: () => call('authorization', authorizationOf),
  requestAuthorization: () => call('requestAuthorization', authorizationOf),
  list: () => call('list', value => Array.isArray(value)
    ? value.map(normalizeScheduledWorkout).filter((row): row is ScheduledWorkout => row !== null)
    : []),
  schedule: (plan) => {
    if (!plan || typeof plan !== 'object' || typeof plan.id !== 'string')
      return Promise.reject(Object.assign(new Error('schedule needs a plan with an id'), { code: 'INVALID_ARGUMENT' }))
    return call('schedule', (value) => {
      const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      const out: ScheduleWorkoutResult = { id: (typeof row.id === 'string' ? row.id : plan.id).toLowerCase() }
      if (Array.isArray(row.droppedAlerts) && row.droppedAlerts.length)
        out.droppedAlerts = row.droppedAlerts.filter((item): item is string => typeof item === 'string')
      return out
    }, plan)
  },
  remove: id => call('remove', value => value === true, id),
  removeAll: () => call('removeAll', value => typeof value === 'number' && Number.isFinite(value) ? value : 0),
}
