import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { resolveXcodegen } from '@stacksjs/actions/build/ios-toolchain'
import { describeGitHubRelease, publishGitHubRelease } from '@stacksjs/actions/github-release'
import { runAction } from '@stacksjs/actions/run-action'
import { intro, italic, log, onUnknownSubcommand, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { AppStoreConnect, appStoreConnectCredentials, buildsToExpire } from '../app-store-connect'
import { bumpedVersion, iosReleaseSummary, iosVersionIn, nextBuildTag, withIosVersion } from '../release-ios'
import { resultFailed } from '../result'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  project: 'Target a specific project',
  dryRun: 'Run the release without actually releasing',
  bump: 'Non-interactive bump: patch | minor | major | prepatch | preminor | premajor | prerelease | pre | release | build | calendar | x.y.z',
  verbose: 'Enable verbose output',
  skipGithubRelease: 'Push the tag without creating its GitHub release',
}

export function release(buddy: CLI): void {
  buddy
    .command('release', descriptions.release)
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--bump <type>', descriptions.bump)
    .option('--preid <identifier>', 'Prerelease channel, for example beta or rc')
    .option('--skip-github-release', descriptions.skipGithubRelease, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ReleaseOptions) => {
      log.debug('Running `buddy release` ...', options)

      if (options.dryRun)
        log.warn('Dry run enabled. No changes will be made or committed.')

      const startTime = await intro('buddy release')
      const result = await runAction(Action.Release, options)

      if (resultFailed(result)) {
        await log.error('Failed to release', result.error)
        process.exit(ExitCode.FatalError)
      }

      // A dry run neither tags nor pushes, so it must not claim it did. This
      // used to print "Successfully released" and "Triggered CI/CD Release"
      // either way, which reads as a release having happened - the one thing
      // a dry run exists to avoid being unsure about.
      await outro(
        options.dryRun
          ? 'Dry run complete. Nothing was committed, tagged or pushed.'
          : 'Triggered CI/CD Release via GitHub Actions',
        { startTime, useSeconds: true },
      )

      if (!options.dryRun)
        log.info(`Follow along: ${italic(resolveGitHubActionsUrl(readOriginRemote()))}`)
    })

  buddy
    .command('release:ios', 'Ship the iOS app: regenerate its project for production, commit, tag and push')
    .option('--bump <type>', 'build | patch | minor | major | x.y.z (default: a new build of the current marketing version)')
    .option('--keep-builds <n>', 'TestFlight builds to keep besides the new one; older ones are expired (needs an App Store Connect API key)', { default: 1 })
    .option('--skip-github-release', descriptions.skipGithubRelease, { default: false })
    .option('--dry-run', descriptions.dryRun, { default: false })
    .action(async (options: IosReleaseOptions) => {
      const startTime = await intro('buddy release:ios')
      try {
        const tag = await releaseIos(options)
        await outro(options.dryRun ? `Dry run complete: would release ${tag}` : `Released ${tag}`, { startTime, useSeconds: true })
        if (!options.dryRun)
          log.info('A CI that builds tags (Xcode Cloud: Tag Changes, prefix "v") turns it into a TestFlight build now.')
      }
      catch (error) {
        await log.error('Failed to release the iOS app', error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('release:github [tag]', 'Create the GitHub release for a pushed tag (default: the newest), with the changes since the tag before it')
    .option('--dry-run', 'Print the release instead of creating it', { default: false })
    .action(async (tag: string | undefined, options: { dryRun?: boolean }) => {
      const startTime = await intro('buddy release:github')
      try {
        const target = tag || git('describe', '--tags', '--abbrev=0')
        if (!git('tag', '--list', target))
          throw new Error(`there is no tag ${target}`)
        // An iOS build tag gets the same title and TestFlight line release:ios gives it.
        const ios = /^v\d+\.\d+\.\d+-build\.\d+$/.test(target)
          ? iosReleaseSummary(target, { numberedByXcodeCloud: appStoreConnectCredentials() !== null })
          : null
        const result = await publishGitHubRelease({ cwd: process.cwd(), tag: target, name: ios?.name, summary: ios?.body, dryRun: options.dryRun })
        if (result.status === 'failed')
          throw new Error(describeGitHubRelease(target, result))
        log.info(options.dryRun && result.draft
          ? `Would create the GitHub release ${target} (${result.draft.name}):\n\n${result.draft.body}`
          : describeGitHubRelease(target, result))
        await outro(options.dryRun ? 'Dry run complete. Nothing was created.' : `GitHub release for ${target}`, { startTime, useSeconds: true })
      }
      catch (error) {
        await log.error('Failed to create the GitHub release', error)
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, 'release')
}

interface IosReleaseOptions {
  bump?: string
  dryRun?: boolean
  keepBuilds?: number | string
  skipGithubRelease?: boolean
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/**
 * One iOS release: the version (bumped when asked), the regenerated project,
 * a commit, a `v<version>-build.<n>` tag, and main pushed with the tag in one
 * atomic push. The project is built for production: MOBILE_URL and the version
 * env overrides a dev shell may carry are dropped for the build.
 */
async function releaseIos(options: IosReleaseOptions): Promise<string> {
  const root = process.cwd()
  const configPath = join(root, 'config/mobile.ts')
  if (!existsSync(configPath))
    throw new Error('config/mobile.ts not found: run this in a Stacks app with a mobile config')

  // The build regenerates the Xcode project with Pantry's xcodegen; a machine
  // without it stops here, before anything is pulled, bumped or committed.
  const xcodegen = await resolveXcodegen(root)
  log.info(`xcodegen ${xcodegen.version} from Pantry (${xcodegen.path})`)

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main')
    throw new Error(`releases are cut from main; this is ${branch}`)
  if (git('status', '--porcelain', '--untracked-files=no'))
    throw new Error('commit or stash your changes first, so the release is exactly what is on main')
  git('pull', '--quiet', '--rebase', 'origin', 'main')
  git('fetch', '--quiet', '--tags', 'origin')

  const source = readFileSync(configPath, 'utf8')
  const current = iosVersionIn(source)
  if (!current)
    throw new Error('config/mobile.ts declares no iOS `version`')
  const version = options.bump ? bumpedVersion(current, options.bump) : current
  const existingTags = git('tag', '--list', `v${version}-build.*`).split('\n').filter(Boolean)
  let tag = nextBuildTag(version, existingTags)

  // With an App Store Connect key, the tag carries the number TestFlight will
  // show: Xcode Cloud numbers every run, failed ones too, so a count of our
  // own tags drifted from it (build.4 arrived as (10)).
  const credentials = appStoreConnectCredentials()
  let store: { api: AppStoreConnect, appId: string } | null = null
  if (credentials) {
    const mobile = (await import(pathToFileURL(configPath).href)).default as { ios?: { bundleId?: string } }
    const bundleId = mobile.ios?.bundleId
    if (!bundleId)
      throw new Error('config/mobile.ts declares no ios.bundleId')
    const api = await AppStoreConnect.connect(credentials)
    store = { api, appId: await api.appId(bundleId) }
    const latestRun = await api.latestXcodeCloudRun(store.appId)
    if (latestRun !== null) {
      tag = nextBuildTag(version, existingTags, latestRun)
    }
  }
  else {
    log.warn('No App Store Connect API key (APP_STORE_CONNECT_KEY_ID, _ISSUER_ID, _PRIVATE_KEY_PATH): the tag counts releases, not the build number TestFlight will show, and older builds stay listed.')
  }

  log.info(`Releasing ${tag}${version === current ? '' : ` (version ${current} → ${version})`}`)
  const keep = Math.max(0, Number(options.keepBuilds ?? 1) || 0)
  // With a key, the tag's number is the Xcode Cloud run, so TestFlight's.
  const summary = iosReleaseSummary(tag, { numberedByXcodeCloud: store !== null })
  if (options.dryRun) {
    if (store) {
      const retiring = buildsToExpire(await store.api.builds(store.appId), keep)
      log.info(retiring.length ? `Would expire TestFlight builds ${retiring.map(b => b.number).join(', ')}` : 'No TestFlight builds to expire')
    }
    if (!options.skipGithubRelease) {
      const preview = await publishGitHubRelease({ cwd: root, tag, ref: 'HEAD', name: summary.name, summary: summary.body, dryRun: true })
      log.info(preview.draft ? `Would create the GitHub release ${tag} (${preview.draft.name}):\n\n${preview.draft.body}` : describeGitHubRelease(tag, preview))
    }
    return tag
  }

  const paths = ['config/mobile.ts', 'storage/framework/mobile/ios']
  if (version !== current) {
    writeFileSync(configPath, withIosVersion(source, version))
    const pkgPath = join(root, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = readFileSync(pkgPath, 'utf8')
      writeFileSync(pkgPath, pkg.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`))
      paths.push('package.json')
    }
  }

  for (const key of ['MOBILE_URL', 'IOS_APP_VERSION', 'IOS_BUILD_NUMBER'])
    delete process.env[key]
  const result = await runAction(Action.BuildIos, {})
  if (resultFailed(result))
    throw result.error ?? new Error('the iOS build failed')

  git('add', '--', ...paths)
  if (git('diff', '--cached', '--name-only'))
    git('commit', '--quiet', '-m', `chore(release): ${tag}`)
  git('tag', '-a', tag, '-m', tag)
  git('push', '--quiet', '--atomic', 'origin', 'main', tag)

  // The tag's GitHub release: the changes since the previous one, and which
  // TestFlight build it becomes. A failure here is reported, not thrown: the
  // tag is out and Xcode Cloud is already building it.
  if (!options.skipGithubRelease) {
    const published = await publishGitHubRelease({ cwd: root, tag, name: summary.name, summary: summary.body })
    if (published.status === 'failed')
      log.warn(describeGitHubRelease(tag, published))
    else
      log.info(describeGitHubRelease(tag, published))
  }

  // The builds this one supersedes leave TestFlight, so its list is the
  // newest kept and this one once it has processed.
  if (store) {
    try {
      const retiring = buildsToExpire(await store.api.builds(store.appId), keep)
      for (const build of retiring)
        await store.api.expire(build.id)
      if (retiring.length)
        log.info(`Expired TestFlight builds ${retiring.map(b => b.number).join(', ')}`)
    }
    catch (error) {
      // The release is out; tidying TestFlight is not worth failing it.
      log.warn(`Could not expire older TestFlight builds: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return tag
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
