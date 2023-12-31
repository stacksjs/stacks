import { runCommand } from 'src/cli/src'
import { isFile } from 'src/storage/src'
import { setEnvValue } from 'src/utils/src'
import { projectPath } from 'src/path/src'
import { generateAppKey } from 'src/security/src'

if (!isFile('.env'))
  await runCommand('cp .env.example .env', { cwd: projectPath() })

await setEnvValue('APP_KEY', generateAppKey())
