// The jobs and actions this application can schedule, derived rather than listed.
//
// `schedule.job('Inpsire')` used to type-check and fail at the scheduled hour,
// with the misspelling visible only in a log line nobody reads at 3am. Same for
// `schedule.action('Actions/NoSuchThing')`, even though the action union has
// existed since `buddy generate:types` learned to write it.
//
// Both sets are derived from things that already exist for other reasons - the
// jobs barrel the runtime imports, and the generated action union - so there is
// nothing here to regenerate and nothing that can drift from them.

import type { ActionPath } from './actions'

/** Every job, by the name the barrel exports it under. */
type Jobs = typeof import('../auto-imports/jobs')

declare module '@stacksjs/scheduler' {
  interface SchedulableJobs extends Jobs {}

  /**
   * `Record<Union, true>` turns the action union into an interface whose keys
   * are the union, which is what `keyof` needs on the other side.
   */
  interface SchedulableActions extends Record<ActionPath, true> {}
}

export {}
