import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'Buddy Versions',
  description: 'This command displays the buddy version.',
  path: 'buddy/versions', // turns into `APP_URL/api/buddy/versions`

  handle() {
    return {
      versions: [
        '1.0',
      ],
    }
  },
})
