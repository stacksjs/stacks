import type { ClarityOptions } from '@stacksjs/clarity'
import * as p from '@stacksjs/path'

const config: ClarityOptions = {
  verbose: false,
  level: 'debug',
  logDirectory: p.projectPath('storage/logs'),
}

export default config
