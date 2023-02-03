import type { HashingOptions } from '@stacksjs/types'

export default <HashingOptions> {
  driver: 'bcrypt',

  bcrypt: {
    rounds: 10,
  },

  argon: {
    memory: 65536,
    threads: 1,
    time: 1,
  },
}
