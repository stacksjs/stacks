import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Buddy Versions',
  description: 'This command displays the buddy version.',

  handle() {
    return {
      versions: ['1.0'],
    }
  },
})
