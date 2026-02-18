import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { generateAppKey } from '@stacksjs/security'
import { existsSync } from '@stacksjs/storage'
import { setEnvValue } from '@stacksjs/utils'

if (!existsSync('.env'))
  await runCommand('cp .env.example .env', { cwd: projectPath() })

await (setEnvValue as any)('APP_KEY', generateAppKey())
