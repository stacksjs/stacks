import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'

export default new Action({
  name: 'CategorizableUpdateAction',
  description: 'Updates an existing categorizable',

  async handle({ id, name, description, categorizableType }) {
    return await categorizable.update(id, {
      name,
      description,
      categorizable_type: categorizableType,
    })
  },
}) 