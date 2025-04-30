import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'

export default new Action({
  name: 'CategorizableStoreAction',
  description: 'Creates a new categorizable',

  async handle({ name, description, categorizableType }) {
    return await categorizable.store({
      name,
      description,
      categorizable_type: categorizableType,
    })
  },
}) 