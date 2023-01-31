import type { HashingOptions as Options } from '@stacksjs/types'

export const config: Options = {
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
