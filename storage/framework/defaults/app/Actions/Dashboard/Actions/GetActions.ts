import { Action } from '@stacksjs/actions'
import process from 'node:process'
import { discoverActionSources } from '../Source/source-inventory'

export default new Action({
  name: 'GetActions',
  description: 'Lists application and framework Actions from their native source files.',
  method: 'GET',
  async handle() {
    const items = await discoverActionSources(process.cwd())

    return {
      items,
      stats: {
        total: items.length,
        application: items.filter(item => item.origin === 'Application').length,
        framework: items.filter(item => item.origin === 'Framework').length,
        writes: items.filter(item => !['ANY', 'GET', 'HEAD', 'OPTIONS'].includes(item.method || 'ANY')).length,
      },
    }
  },
})
