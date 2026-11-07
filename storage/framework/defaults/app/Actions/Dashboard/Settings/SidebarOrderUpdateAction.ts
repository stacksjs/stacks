import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'
import { sidebarOrderScope, writeSidebarOrder } from './sidebar-order-store'
import { sidebarOrderViewer } from './sidebar-order-viewer'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'SidebarOrderUpdateAction', method: 'PUT', apiResponse: true,
  description: 'Atomically saves personal sidebar identifiers without editing team defaults.',
  validations: {
    order: { rule: schema.object({}).required() },
    scope: { rule: schema.string().min(32).max(32).required() },
  },
  responses: {
    200: { description: 'The saved personal order.', schema: { type: 'object', additionalProperties: true } },
    409: { description: 'The viewer or project changed since the order was loaded.' },
    422: { description: 'The order payload is invalid or exceeds its bounds.' },
    503: { description: 'The local preference file could not be written.' },
  },
  async handle(request: RequestInstance) {
    try {
      const location = { viewer: await sidebarOrderViewer(request) }
      if (request.get('scope') !== sidebarOrderScope(location))
        return response.json({ message: 'The dashboard viewer changed. Reload sidebar order before saving.' }, 409)
      const order = await writeSidebarOrder(request.get('order'), location)
      return response.json({ order }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    catch (error) {
      if (error instanceof TypeError) return response.json({ message: error.message }, 422)
      return dashboardOperationalError(error, 'Sidebar order could not be saved.', 'SidebarOrderUpdateAction', 503)
    }
  },
})
