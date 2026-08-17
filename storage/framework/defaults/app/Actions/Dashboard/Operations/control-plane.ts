import type { RequestInstance } from '@stacksjs/types'
import type {
  ControlPlaneActor,
  ControlPlaneOperation,
  JsonValue,
} from '@stacksjs/ts-cloud'
// Lives on the `/deploy` entry alongside `initializeDashboardControlPlane`,
// not on the package root - importing it from the root silently produced
// `any`, and every caller of this helper inherited that.
import type { DashboardControlPlane } from '@stacksjs/ts-cloud/deploy'
import process from 'node:process'
import { setStateDir } from '@stacksjs/ts-cloud'
import { initializeDashboardControlPlane } from '@stacksjs/ts-cloud/deploy'
import { tsCloud } from '~/config/cloud'

let dashboardControlPlane: DashboardControlPlane | undefined

export function operationsControlPlane(): DashboardControlPlane {
  if (dashboardControlPlane)
    return dashboardControlPlane

  setStateDir(tsCloud.stateDir)
  dashboardControlPlane = initializeDashboardControlPlane(process.cwd(), tsCloud)
  return dashboardControlPlane
}

export async function dashboardOperator(request: RequestInstance): Promise<ControlPlaneActor> {
  const controlPlane = operationsControlPlane()
  const user = await request.user()
  const id = Number(user?.id)
  const externalId = Number.isSafeInteger(id) && id > 0 ? `stacks-user:${id}` : 'stacks-dashboard:local'
  const kind = Number.isSafeInteger(id) && id > 0 ? 'user' : 'system'
  const displayName = String(user?.name || user?.email || (kind === 'system' ? 'Local dashboard' : `User ${id}`))

  return controlPlane.store.getActorByExternalId(kind, externalId)
    ?? controlPlane.store.createActor({
      kind,
      externalId,
      displayName,
      metadata: {
        source: 'stacks-dashboard',
        ...(user?.email ? { email: String(user.email) } : {}),
      },
    })
}

export function operationsEnvironment(controlPlane = operationsControlPlane()) {
  const requested = String(process.env.CLOUD_ENV || process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase()
  return controlPlane.environments.get(requested)
    ?? controlPlane.environments.get('development')
    ?? controlPlane.environments.values().next().value
}

/**
 * `T` is only required to be serializable, not to BE a `JsonValue`.
 *
 * An interface without an index signature - `Alert`, `ReconcileResult` - never
 * satisfies `{ [key: string]: JsonValue }` structurally, however plainly
 * JSON-shaped its fields are. Constraining the result that way meant the
 * honest callers were the ones that failed to typecheck, so the constraint is
 * dropped here and the value is narrowed once, where it is actually recorded.
 */
export async function trackOperatorOperation<T>(
  request: RequestInstance,
  kind: string,
  input: JsonValue,
  execute: () => Promise<T>,
): Promise<{ result: T, operation: ControlPlaneOperation }> {
  const controlPlane = operationsControlPlane()
  const actor = await dashboardOperator(request)
  let operation = controlPlane.store.createOperation({
    projectId: controlPlane.project.id,
    environmentId: operationsEnvironment(controlPlane)?.id,
    actorId: actor.id,
    kind,
    input,
  })

  operation = controlPlane.store.transitionOperation(operation.id, {
    to: 'running',
    expectedVersion: operation.version,
  })
  controlPlane.store.appendEvent({
    organizationId: controlPlane.organization.id,
    projectId: controlPlane.project.id,
    operationId: operation.id,
    actorId: actor.id,
    correlationId: operation.correlationId,
    type: `${kind}.started`,
    payload: input,
  })

  try {
    const result = await execute()
    operation = controlPlane.store.transitionOperation(operation.id, {
      to: 'succeeded',
      expectedVersion: operation.version,
      output: result as JsonValue,
    })
    controlPlane.store.appendEvent({
      organizationId: controlPlane.organization.id,
      projectId: controlPlane.project.id,
      operationId: operation.id,
      actorId: actor.id,
      correlationId: operation.correlationId,
      type: `${kind}.succeeded`,
      payload: result as JsonValue,
    })
    return { result, operation }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    operation = controlPlane.store.transitionOperation(operation.id, {
      to: 'failed',
      expectedVersion: operation.version,
      error: message,
    })
    controlPlane.store.appendEvent({
      organizationId: controlPlane.organization.id,
      projectId: controlPlane.project.id,
      operationId: operation.id,
      actorId: actor.id,
      correlationId: operation.correlationId,
      type: `${kind}.failed`,
      level: 'error',
      payload: { message },
    })
    throw error
  }
}

export async function appendOperatorEvent(
  request: RequestInstance,
  type: string,
  payload: JsonValue,
  resourceId?: string,
): Promise<void> {
  const controlPlane = operationsControlPlane()
  const actor = await dashboardOperator(request)
  controlPlane.store.appendEvent({
    organizationId: controlPlane.organization.id,
    projectId: controlPlane.project.id,
    resourceId,
    actorId: actor.id,
    type,
    payload,
  })
}

export function recentOperatorOperations(prefix: string, limit = 20): Array<ControlPlaneOperation & { actorName: string }> {
  const controlPlane = operationsControlPlane()
  return controlPlane.store
    .listOperations({ projectId: controlPlane.project.id, limit: Math.max(limit * 5, 100) })
    .filter(operation => operation.kind.startsWith(prefix))
    .slice(0, limit)
    .map(operation => ({
      ...operation,
      actorName: operation.actorId
        ? controlPlane.store.getActor(operation.actorId)?.displayName || 'Unknown operator'
        : 'System',
    }))
}
