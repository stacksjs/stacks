import { runCommand } from 'stacks:cli'
import { isFile } from 'stacks:storage'
import { setEnvValue } from 'stacks:utils'
import { projectPath } from 'stacks:path'
import { generateAppKey } from 'stacks:security'

if (!isFile('.env'))
  await runCommand('cp .env.example .env', { cwd: projectPath() })

await setEnvValue('APP_KEY', generateAppKey())
