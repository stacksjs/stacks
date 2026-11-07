import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { sidebarOrderScope, writeSidebarOrder } from './sidebar-order-store'
import { sidebarOrderViewer } from './sidebar-order-viewer'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'SidebarOrderUpdateAction', method: 'PUT', apiResponse: true,
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
