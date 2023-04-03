import { defineDebugConfig } from 'stacks/core/config/src'

/**
 * **Debug Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDebugConfig({
  enabled: true,
  host: 'localhost',
  port: 23517,
})
