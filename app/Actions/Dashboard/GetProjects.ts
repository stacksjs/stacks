import { Action } from '@stacksjs/actions'
// import { Project } from '@stacksjs/orm'

export default new Action({
  name: 'GetProjects',
  description: 'Gets your local Stacks projects.',
  path: '/api/projects',

  async handle() {
    console.log('GetProjects called from Action')
    // return Project.take(3) // reuse the buddy list:projects command
  },
})
