import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

interface PublishOptions {
  force?: boolean
  verbose?: boolean
}

export function publish(buddy: CLI): void {
  const descriptions = {
    command: 'Publish a Stacks default into your userland (app/) directory so you can customize it',
    model: 'Publish a default model from storage/framework/defaults/app/Models/ to app/Models/',
    controller: 'Publish a default controller from storage/framework/defaults/app/Controllers/ to app/Controllers/',
    middleware: 'Publish a default middleware from storage/framework/defaults/app/Middleware/ to app/Middleware/',
    name: 'The name of the resource to publish (e.g. Cart, User)',
    force: 'Overwrite an existing userland file',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('publish:model <name>', descriptions.model)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'model',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Models'),
        userDir: path.userModelsPath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish:controller <name>', descriptions.controller)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'controller',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Controllers'),
        userDir: path.userControllersPath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish:middleware <name>', descriptions.middleware)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'middleware',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Middleware'),
        userDir: path.userMiddlewarePath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish [resource] [name]', descriptions.command)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (resource: string | undefined, name: string | undefined, options: PublishOptions) => {
      if (!resource || !name) {
        log.error('Usage: buddy publish:<resource> <Name>  (e.g. buddy publish:model Cart)')
        process.exit(ExitCode.FatalError)
      }

      const dispatch: Record<string, () => Promise<void>> = {
        model: () => publishResource({
          kind: 'model',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Models'),
          userDir: path.userModelsPath(),
          force: !!options.force,
        }),
        controller: () => publishResource({
          kind: 'controller',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Controllers'),
          userDir: path.userControllersPath(),
          force: !!options.force,
        }),
        middleware: () => publishResource({
          kind: 'middleware',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Middleware'),
          userDir: path.userMiddlewarePath(),
          force: !!options.force,
        }),
      }

      const handler = dispatch[resource.toLowerCase()]

      if (!handler) {
        log.error(`Unknown publishable resource: ${italic(resource)}`)
        log.info('Available: model, controller, middleware')
        process.exit(ExitCode.FatalError)
      }

      await handler()
    })

  buddy.on('publish:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

interface PublishContext {
  kind: 'model' | 'controller' | 'middleware'
  name: string
  defaultsDir: string
  userDir: string
  force: boolean
}

async function publishResource(ctx: PublishContext): Promise<void> {
  const { kind, name, defaultsDir, userDir, force } = ctx
  const fileName = name.endsWith('.ts') ? name : `${name}.ts`

  // Locate the default — search recursively so namespaced subdirs (e.g. commerce/) resolve.
  const matches = globSync([`${defaultsDir}/**/${fileName}`], { absolute: true })

  if (!matches.length) {
    log.error(`Could not find default ${kind}: ${italic(fileName)}`)
    log.info(`Looked under: ${italic(defaultsDir)}`)
    process.exit(ExitCode.FatalError)
  }

  if (matches.length > 1) {
    log.warn(`Multiple defaults match ${italic(fileName)}; using the first:`)
    for (const m of matches) log.info(`  ${m}`)
  }

  const sourcePath = matches[0]
  const targetPath = `${userDir.replace(/\/$/, '')}/${fileName}`

  if (existsSync(targetPath) && !force) {
    log.error(`Already exists: ${italic(targetPath)}`)
    log.info('Pass --force to overwrite.')
    process.exit(ExitCode.FatalError)
  }

  mkdirSync(dirname(targetPath), { recursive: true })

  await fs.promises.copyFile(sourcePath, targetPath)

  log.success(`Published ${kind} ${italic(name)} → ${italic(targetPath.replace(`${process.cwd()}/`, ''))}`)
}
