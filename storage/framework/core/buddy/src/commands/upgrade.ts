import type { CLI, UpgradeOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function upgrade(buddy: CLI): void {
  const descriptions = {
    upgrade: 'Upgrade the Stacks framework to the latest version',
    version: 'Install a specific version (e.g., 0.70.23)',
    canary: 'Upgrade to the latest canary (development) build',
    stable: 'Switch back to the latest stable release',
    force: 'Force re-download, bypassing cache and version checks',
    from: 'Sync from a local stacks checkout (e.g. ~/Code/stacks). Skips GitHub.',
    noPostinstall: 'Skip post-sync hooks (auto-imports, bun install, migrate)',
    verbose: 'Enable verbose output',
    dependencies: 'Upgrade your dependencies (pantry.yaml & package.json)',
    bun: 'Upgrade Bun to the latest version',
    shell: 'Upgrade the shell integration (currently only supports Oh My Zsh)',
    binary: 'Upgrade the `stacks` binary to the latest version',
    project: 'Target a specific project',
    all: 'Upgrade framework, dependencies, Bun, and binary',
  }

  // Main command: `buddy upgrade` upgrades the framework by default
  buddy
    .command('upgrade', descriptions.upgrade)
    .option('-v, --version <version>', descriptions.version)
    .option('--canary', descriptions.canary, { default: false })
    .option('--stable', descriptions.stable, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--from <path>', descriptions.from)
    // No `default` here — cac treats `--no-postinstall` as a negation flag and
    // would set `postinstall: false` by default if we passed `default: false`,
    // making the script silently skip post-sync hooks even when the user did
    // not pass the flag. Letting cac handle the default keeps the natural
    // behavior: hooks run unless `--no-postinstall` is explicitly given.
    .option('--no-postinstall', descriptions.noPostinstall)
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('update')
    .example('buddy upgrade')
    .example('buddy upgrade --from ~/Code/stacks')
    .example('buddy upgrade --version 0.70.23')
    .example('buddy upgrade --canary')
    .example('buddy upgrade --stable')
    .example('buddy upgrade --force')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade` ...', options)

      // cac parses `--no-postinstall` as `{ postinstall: false }`. The
      // shared `buddyOptions` serializer used by `runAction` drops keys
      // whose value is `false`, so the flag would silently disappear on
      // the way to the action. Re-emit it as a true boolean the action
      // already understands.
      const opts: UpgradeOptions = { ...options }
      if (opts.postinstall === false) {
        delete (opts as Record<string, unknown>).postinstall
        opts.noPostinstall = true
      }

      const perf = await intro('buddy upgrade')
      const result = await runAction(Action.UpgradeFramework, opts)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Upgrade complete.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  // Upgrade everything: framework + deps + bun + binary
  buddy
    .command('upgrade:all', descriptions.all)
    .option('--canary', descriptions.canary, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:all')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:all` ...', options)

      const perf = await intro('buddy upgrade:all')

      // set all flag so the dispatcher runs everything
      options.all = true
      const result = await runAction(Action.Upgrade, options)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade:all, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('All upgrades complete.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:dependencies', descriptions.dependencies)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('upgrade:deps')
    .example('buddy upgrade:dependencies')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:dependencies` ...', options)

      const perf = await intro('buddy upgrade:dependencies')
      options.dependencies = true
      const result = await runAction(Action.Upgrade, options)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade:dependencies, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Dependencies upgraded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:bun', descriptions.bun)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:bun')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:bun` ...', options)

      const perf = await intro('buddy upgrade:bun')
      const result = await runAction(Action.UpgradeBun, options)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade:bun, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Bun upgraded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:shell', descriptions.shell)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:shell')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:shell` ...', options)

      const perf = await intro('buddy upgrade:shell')
      const result = await runAction(Action.UpgradeShell, options)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade:shell, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Shell integration upgraded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:binary', descriptions.binary)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:binary')
    .action(async (options: UpgradeOptions) => {
      if (process.getuid && process.getuid() !== 0) {
        log.warn('To upgrade the binary, you need to run this command with sudo, or as root.')
        process.exit(ExitCode.FatalError)
      }

      log.debug('Running `buddy upgrade:binary` ...', options)

      const perf = await intro('buddy upgrade:binary')
      const result = await runAction(Action.UpgradeBinary, options)

      if (result.isErr) {
        await outro(
          'While running buddy upgrade:binary, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Binary upgraded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('upgrade:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
