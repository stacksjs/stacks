import process from 'node:process'
import { cli } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

// setup global error handlers
process.on('uncaughtException', handleError)
process.on('unhandledRejection', handleError)

async function main() {
  const buddy = cli(config.cli.name)

  if (!fs.existsSync(p.projectPath(config.cli.command)))
    fs.writeFileSync(p.projectPath(config.cli.command), `import('./storage/framework/core/buddy/src/custom-cli')`)

  // dynamically import and register commands from ./app/Commands/*
  const commandsDir = p.appPath('Commands')
  const commandFiles = fs.readdirSync(commandsDir).filter((file: string) => file.endsWith('.ts'))

  for (const file of commandFiles) {
    const commandPath = `${commandsDir}/${file}`
    const dynamicImport = await import(commandPath)

    // Correctly use the default export function
    if (typeof dynamicImport.default === 'function')
      dynamicImport.default(buddy)
    else console.error(`Expected a default export function in ${file}, but got:`, dynamicImport.default)
  }

  buddy.parse()
}

await main()
