import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetProjects',
  description: 'Gets your local Stacks projects.',
  method: 'GET',

  async handle() {
    // TODO: replace with model query when Project model is available
    return { projects: [] }
  },
})
