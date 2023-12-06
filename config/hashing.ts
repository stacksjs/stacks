import type { HashingConfig } from '@stacksjs/types'

/**
 * **Hashing Configuration**
 *
 * This configuration defines all of your hashing options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'argon2',

  bcrypt: {
    rounds: 10,
    cost: 4, // number between 4-31
  },

  argon2: {
    memory: 65536, // memory usage in kibibytes
    threads: 1,
    time: 1, // the number of iterations
  },
} satisfies HashingConfig
