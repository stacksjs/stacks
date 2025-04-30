import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'

export default new Action({
  name: 'CategorizableIndexAction',
  description: 'Fetches all categorizables',

  async handle() {
    return await categorizable.fetchAll()
  },
}) 