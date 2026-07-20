import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, italic, log, onUnknownSubcommand, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  project: 'Target a specific project',
  dryRun: 'Run the release without actually releasing',
  bump: 'Non-interactive bump: patch | minor | major | prepatch | preminor | premajor | prerelease | x.y.z',
  verbose: 'Enable verbose output',
}

export function release(buddy: CLI): void {
  buddy
    .command('release', descriptions.release)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--bump <type>', descriptions.bump)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ReleaseOptions) => {
      log.debug('Running `buddy release` ...', options)

      if (options.dryRun)
        log.warn('Dry run enabled. No changes will be made or committed.')

      const startTime = await intro('buddy release')
      const result = await runAction(Action.Release, options)

      if (result.isErr) {
        log.error('Failed to release', result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Triggered CI/CD Release via GitHub Actions', {
        startTime,
        useSeconds: true,
      })

      log.info(`Follow along: ${italic(resolveGitHubActionsUrl(readOriginRemote()))}`)
    })

  onUnknownSubcommand(buddy, 'release')
}

export function resolveGitHubActionsUrl(
  remoteUrl?: string,
  repository = process.env.GITHUB_REPOSITORY,
  serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com',
): string {
  const repo = repository?.trim() || remoteUrl?.trim().match(/github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)?.[1]
  return repo ? `${serverUrl.replace(/\/$/, '')}/${repo}/actions` : 'https://github.com/stacksjs/stacks/actions'
}

function readOriginRemote(): string | undefined {
  try {
    return execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim()
  }
  catch {
    return undefined
  }
}
