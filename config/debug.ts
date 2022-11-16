import { type DebugOptions as Options } from '@stacksjs/types'

/**
 * ### Debug Options
 *
 * This configuration defines all of your database options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const debug: Options = {
  driver: 'ray',
  enable: true,
  host: 'localhost',
  port: 23517,
}
