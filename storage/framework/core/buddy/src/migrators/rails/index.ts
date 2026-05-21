/**
 * Rails → Stacks migrator stub (stacksjs/stacks#1241).
 *
 * The Laravel driver shipped first because Eloquent + Laravel
 * migrations are closer in shape to Stacks' model + SQL migration
 * format. The Rails driver will need separate parsers for:
 *
 *   - ActiveRecord models       (app/models/<name>.rb)
 *   - schema.rb / migration DSL (db/migrate/<timestamp>_<name>.rb)
 *   - routes.rb DSL             (config/routes.rb)
 *   - ERB views                 (app/views — recursive)
 *
 * Until that lands, the command surfaces a clear "not yet
 * implemented" status — the contract is stable so adding the driver
 * is a drop-in once written.
 */

import type { Driver, MigrateProjectRequest, ReportEntry } from '../types'

export const railsDriver: Driver = {
  name: 'rails',
  async migrate(_req: MigrateProjectRequest): Promise<ReportEntry[]> {
    return [{
      source: '.',
      target: '',
      status: 'skipped',
      note: 'Rails driver is not yet implemented (stacksjs/stacks#1241 — Laravel driver shipped first). Track follow-up at github.com/stacksjs/stacks/issues/1241.',
    }]
  },
}
