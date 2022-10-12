import type { HashingOptions } from 'stacks/src'

export const hashing: HashingOptions = {
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
