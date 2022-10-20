/**
 * The following configuration references local aliases.
 */

import { projectPath } from '.'

const alias: Record<string, string> = {
  '~/*': projectPath('*'),
}

export { alias }
