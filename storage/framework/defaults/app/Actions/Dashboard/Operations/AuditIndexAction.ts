import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { operationsControlPlane } from './control-plane'

export default new Action({
  name: 'AuditIndexAction',
  description: 'Returns the append-only operator event stream and its correlated operations.',
  method: 'GET',
  apiResponse: true,
  async handle(_request: RequestInstance) {
    const controlPlane = operationsControlPlane()
    const events = controlPlane.store.listEvents({ projectId: controlPlane.project.id, limit: 500 })
    const operations = controlPlane.store.listOperations({ projectId: controlPlane.project.id, limit: 200 })
    return {
      events: events.map(event => ({ ...event, actorName: event.actorId ? controlPlane.store.getActor(event.actorId)?.displayName || 'Unknown operator' : 'System' })),
      operations,
      summary: {
        events: events.length,
        operators: new Set(events.map(event => event.actorId).filter(Boolean)).size,
        failures: events.filter(event => event.level === 'error').length,
        latestSequence: events.reduce((latest, event) => Math.max(latest, event.sequence), 0),
      },
    }
  },
})
