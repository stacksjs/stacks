import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'

export default new Action({
  name: 'CategorizableDestroyAction',
  description: 'Deletes a categorizable',

  async handle({ id }) {
    return await categorizable.destroy(id)
  },
}) 