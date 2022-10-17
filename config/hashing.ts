import type { HashingOptions as Options } from 'stacks/src'

export const hashing: Options = {
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
