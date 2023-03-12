import { runCommands } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommands([
  'pnpm buddy clean',
  'pnpm install',
  'npx prisma generate --schema=./database/schema.prisma',
], { cwd: frameworkPath(), verbose: true })
