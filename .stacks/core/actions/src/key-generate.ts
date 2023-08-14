import { runCommand } from '@stacksjs/cli'
import { isFile } from '@stacksjs/storage'
import { setEnvValue } from '@stacksjs/utils'
import { projectPath } from '@stacksjs/path'
import { generateAppKey } from '@stacksjs/security'

if (!isFile('.env'))
  runCommand('cp .env.example .env', { cwd: projectPath() })

await setEnvValue('APP_KEY', generateAppKey())
