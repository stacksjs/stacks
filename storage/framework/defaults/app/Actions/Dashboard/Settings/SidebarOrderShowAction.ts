import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { readSidebarOrder, sidebarOrderScope } from './sidebar-order-store'
import { sidebarOrderViewer } from './sidebar-order-viewer'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'SidebarOrderShowAction', method: 'GET', apiResponse: true,
  description: 'Loads the current viewer\'s machine-local sidebar order.',
  responses: {
    200: { description: 'The saved order, viewer scope and any recoverable file warning.', schema: { type: 'object', additionalProperties: true } },
    503: { description: 'The local preference file could not be read.' },
  },
  async handle(request: RequestInstance) {
    try {
      const location = { viewer: await sidebarOrderViewer(request) }
      return response.json({ ...await readSidebarOrder(location), scope: sidebarOrderScope(location) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    catch (error) { return dashboardOperationalError(error, 'Sidebar order could not be loaded.', 'SidebarOrderShowAction', 503) }
  },
})
