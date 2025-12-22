import type { HashingConfig } from '@stacksjs/types'

/**
 * **Hashing Configuration**
 *
 * This configuration defines all of your hashing options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  /**
   * Default hashing driver (Laravel uses bcrypt by default)
   * Options: 'bcrypt' | 'argon2' | 'argon2id' | 'argon2i' | 'argon2d'
   */
  driver: 'bcrypt',

  bcrypt: {
    /**
     * Bcrypt rounds (cost factor)
     * Higher = more secure but slower
     * Laravel default: 10-12
     */
    rounds: 12,
  },

  argon2: {
    memory: 65536, // memory usage in kibibytes
    time: 2, // the number of iterations
  },
} satisfies HashingConfig
