import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle() {
  // async handle(request: UserRequestType) {
    // const id = request.getParam('id')

    // const user = await Error.whereColumn('id', '')

    // user?.update({ job_title: 'Senior Software Engineer' })
    // user?.delete()

    return response.json(user)
  },
})
