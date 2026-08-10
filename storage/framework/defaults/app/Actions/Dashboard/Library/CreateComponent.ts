import type { RequestInstance } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { Action, createComponent as scaffoldComponent } from '@stacksjs/actions'
import { userComponentsPath } from '@stacksjs/path'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { componentSourceRows } from './library-source'

export default new Action({
  name: 'CreateComponent',
  description: 'Creates a new STX component.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const name = String(request.get('name') || '').trim()

    if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
      return response.json({ message: 'Use a PascalCase component name.' }, 422)

    try {
      const destination = userComponentsPath(`${name}.stx`)
      if (existsSync(destination))
        return response.json({ message: 'A component with that name already exists.' }, 409)

      await scaffoldComponent({ name })

      const created = componentSourceRows().find(component => component.name === name)
      if (!created)
        throw new Error(`Scaffolded component ${name} could not be found in resources/components.`)
      return response.json({ component: created }, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'The component could not be created.', 'CreateComponent', 500)
    }
  },
})
