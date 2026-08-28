// The actions this application can schedule, derived rather than listed.
//
// `schedule.action('Actions/NoSuchThing')` used to type-check and fail at the
// scheduled hour, with the misspelling visible only in a log line nobody reads
// at 3am.
//
// The jobs half of this used to live here too, read from the jobs barrel. That
// barrel is generated for the RUNTIME and holds only `app/Jobs/`, while
// `resolveJobFile` resolves the framework defaults as well - so the nine jobs
// that ship with Stacks were unschedulable by type and perfectly dispatchable
// at runtime. `generate:types` writes that union now, from the same three
// directories the resolver tries.

import type { ActionPath } from './actions'

declare module '@stacksjs/scheduler' {
  /**
   * `Record<Union, true>` turns the action union into an interface whose keys
   * are the union, which is what `keyof` needs on the other side.
   */
  interface SchedulableActions extends Record<ActionPath, true> {}
}

export {}
