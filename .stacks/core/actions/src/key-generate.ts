import { runCommand } from '@stacksjs/cli'
import { isFile } from '@stacksjs/storage'
import { setEnvValue } from '@stacksjs/utils'
import { options } from 'kolorist'
import { generateAppKey } from '@stacksjs/security'

if (!isFile('.env'))
  await runCommand('cp .env.example .env', { ...options, cwd: projectPath() })

await setEnvValue('APP_KEY', await generateAppKey())
