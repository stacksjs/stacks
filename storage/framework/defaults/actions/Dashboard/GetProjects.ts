import { Action } from '@stacksjs/actions'
// import { Project } from '@stacksjs/orm'

export default new Action({
  name: 'GetProjects',
  description: 'Gets your local Stacks projects.',
  path: '/projects',

  async handle() {
    // eslint-disable-next-line no-console
    console.log('GetProjects called from Action')
    // return Project.take(3) // reuse the buddy list:projects command
  },
})
