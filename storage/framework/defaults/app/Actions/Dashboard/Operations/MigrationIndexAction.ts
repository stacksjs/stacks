import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { recentOperatorOperations } from './control-plane'
import { migrationPlan, reconcileMigrationLedgerPlan } from './migration-operations'

export default new Action({
  name: 'MigrationIndexAction',
  description: 'Returns the model-derived schema plan and migration ledger health.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    try {
      return {
        ...await migrationPlan(),
        reconciliation: await reconcileMigrationLedgerPlan(false),
        operatorOperations: recentOperatorOperations('dashboard.migrations.', 20),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Migration operations could not be loaded.', 'MigrationIndexAction')
    }
  },
})
