import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'

export default new Action({
  name: 'CategorizableShowAction',
  description: 'Fetches a specific categorizable by ID',

  async handle({ id }) {
    return await categorizable.fetchById(id)
  },
}) 