import type { HashingConfig } from '@stacksjs/types'

/**
 * **Hashing Configuration**
 *
 * This configuration defines all of your hashing options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'bcrypt',

  bcrypt: {
    rounds: 10,
  },

  argon: {
    memory: 65536,
    threads: 1,
    time: 1,
  },
} satisfies HashingConfig
