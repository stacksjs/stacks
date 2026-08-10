import { Action } from '@stacksjs/actions'
import { dashboardOperationalError } from '../dashboard-response'
import { componentSourceRows } from './library-source'

export default new Action({
  name: 'GetComponents',
  description: 'Gets your UI components.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const components = componentSourceRows()
      const categories = ['All', ...new Set(components.map(component => component.category))]

      return {
        components,
        categories,
        totalBytes: components.reduce((sum, component) => sum + component.bytes, 0),
        sourceRoot: 'resources/components',
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Component library could not be loaded.', 'GetComponents')
    }
  },
})
