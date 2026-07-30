import { Action } from '@stacksjs/actions'
import { componentSourceRows } from './library-source'

export default new Action({
  name: 'GetComponents',
  description: 'Gets your UI components.',
  method: 'GET',

  async handle() {
    const components = componentSourceRows()
    const categories = ['All', ...new Set(components.map(component => component.category))]

    return {
      components,
      categories,
      totalBytes: components.reduce((sum, component) => sum + component.bytes, 0),
      sourceRoot: 'resources/components',
    }
  },
})
