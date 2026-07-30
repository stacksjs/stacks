import type { RequestInstance } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { Action, createFunction as scaffoldFunction } from '@stacksjs/actions'
import { userFunctionsPath } from '@stacksjs/path'
import { response } from '@stacksjs/router'
import { functionSourceRows } from './library-source'

export default new Action({
  name: 'CreateFunction',
  description: 'Creates a new function.',
  method: 'POST',

  async handle(request: RequestInstance) {
    const name = String(request.get('name') || '').trim().toLowerCase()

    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
      return response.json({ message: 'Use a lowercase kebab-case function name.' }, 422)

    const destination = userFunctionsPath(`${name}.ts`)
    if (existsSync(destination))
      return response.json({ message: 'A function with that name already exists.' }, 409)

    await scaffoldFunction({ name })

    const created = functionSourceRows().find(fn => fn.name === name)
    return response.json({ function: created }, 201)
  },
})
