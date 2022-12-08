import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

// eslint-disable-next-line no-console
console.log('here')
await runCommand('npx bumpp ../package.json ./package.json ./core/**/package.json --execute \'pnpm run changelog\'', { debug: true, cwd: frameworkPath() })
