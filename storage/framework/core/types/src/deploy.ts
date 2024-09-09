import type { CliOptions } from './cli'

/**
 * **Deploy Options**
 *
 * This configuration defines all of your deployment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface DeployOptions extends CliOptions {
  domain?: string
  deploy?: boolean
  prod?: boolean
  dev?: boolean
  staging?: boolean
  yes?: boolean
}
