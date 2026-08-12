import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { trackOperatorOperation } from './control-plane'
import { migrationPlan, reconcileMigrationLedgerPlan } from './migration-operations'
import { stringValue } from './recovery-input'

export default new Action({
  name: 'MigrationReconcileAction',
  description: 'Conservatively reconciles provable migration ledger drift.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const input = request.all() as Record<string, unknown>
    const plan = await migrationPlan()
    if (stringValue(input.revision) !== plan.revision)
      return response.json({ message: 'The migration state changed. Refresh before reconciling.' }, 409)
    if (stringValue(input.confirmation) !== `reconcile ${plan.environment}`)
      return response.json({ message: `Type reconcile ${plan.environment} to confirm ledger repair.` }, 422)
    const tracked = await trackOperatorOperation(request, 'dashboard.migrations.reconcile', { revision: plan.revision }, () => reconcileMigrationLedgerPlan(true))
    return { success: true, result: tracked.result, operation: tracked.operation }
  },
})
