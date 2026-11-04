import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { resolveXcodegen } from '@stacksjs/actions/build/ios-toolchain'
import { describeGitHubRelease, publishGitHubRelease, resolveGitHubToken } from '@stacksjs/actions/github-release'
import { validateReleaseEvidencePlan, verifyReleaseEvidence } from '@stacksjs/actions/release-evidence'
import { assertPublicationAllowed } from '@stacksjs/actions/publication-preflight'
import { runAction } from '@stacksjs/actions/run-action'
import { intro, italic, log, onUnknownSubcommand, outro } from '@stacksjs/cli'
import { printAsync } from '@stacksjs/cli/output'
import { Action } from '@stacksjs/enums'
import { withholdEnv } from '@stacksjs/env'
import { ExitCode } from '@stacksjs/types'
import type { ReleaseNotesConfig } from '@stacksjs/actions/release-notes'
import { AppStoreConnect, appStoreConnectCredentials, buildsToExpire, waitForBuild } from '../app-store-connect'
import { bumpedVersion, iosReleaseSummary, iosVersionIn, nextBuildTag, pushIosReleaseTag, unreleasableSite, withIosVersion } from '../release-ios'
import { appStoreLocales, commitsBetween, committedWhatToTest, fitNotes, NO_VISIBLE_CHANGES, PLAY_NOTES_LIMIT, previousMobileTag, resolveNotes, TESTFLIGHT_NOTES_LIMIT, testerNotes, writeWhatToTest, XCODE_CLOUD_NOTES_LIMIT } from '@stacksjs/actions/release-notes'
import { resultFailed } from '../result'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  project: 'Target a specific project',
  dryRun: 'Run the release without actually releasing',
  bump: 'Non-interactive bump: patch | minor | major | prepatch | preminor | premajor | prerelease | pre | release | build | calendar | x.y.z',
  verbose: 'Enable verbose output',
  skipGithubRelease: 'Push the tag without creating its GitHub release',
}

interface IosReleaseOptions {
  bump?: string
  dryRun?: boolean
  keepBuilds?: number | string
  skipGithubRelease?: boolean
  notes?: string
  notesFile?: string
  wait?: boolean | number | string
}

/** Where the Xcode project lives in an app; Xcode Cloud reads TestFlight/ beside it. */
const IOS_PROJECT_DIR = 'storage/framework/mobile/ios'

/** How long `--wait` waits for Xcode Cloud's upload when no minutes are given. */
const DEFAULT_WAIT_MINUTES = 60

interface MobileReleaseSettings {
  ios?: { bundleId?: string, nativeMessages?: { languages?: string[] }, testFlightGroups?: string[] }
  release?: ReleaseNotesConfig
}

async function loadMobileConfig(configPath: string): Promise<MobileReleaseSettings> {
  return ((await import(pathToFileURL(configPath).href)).default ?? {}) as MobileReleaseSettings
}

/** `--wait` as minutes, or null when the release should not wait. */
export function waitMinutes(value: IosReleaseOptions['wait']): number | null {
  if (value === undefined || value === false)
    return null
  if (value === true || value === '')
    return DEFAULT_WAIT_MINUTES
  const minutes = Number(value)
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new Error(`--wait takes minutes, not ${String(value)}`)
  return minutes
}

export function retainedBuildCount(value: number | string | undefined): number {
  if (value !== undefined && typeof value !== 'number' && typeof value !== 'string'
    || typeof value === 'string' && !/^(0|[1-9]\d*)$/.test(value.trim()))
    throw new Error('--keep-builds needs a nonnegative integer')
  const count = Number(value ?? 1)
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error('--keep-builds needs a nonnegative integer')
  return count
}

/** The TestFlight build number an iOS build tag names. */
function buildNumberOf(tag: string): { version: string, number: number } {
  const match = /^v(\d+\.\d+\.\d+)-build\.(\d+)$/.exec(tag)
  if (!match)
    throw new Error(`${tag} is not an iOS build tag (v<version>-build.<n>)`)
  return { version: match[1]!, number: Number(match[2]) }
}

/** The locales the notes are written in: config/mobile.ts `release.locales`, else the app's languages. */
function notesLocales(mobile: MobileReleaseSettings): string[] {
  return mobile.release?.locales?.length ? [...new Set(mobile.release.locales)] : appStoreLocales(mobile.ios?.nativeMessages?.languages)
}

/**
 * Wait for Xcode Cloud's upload of `tag`, then set its What to Test through
 * App Store Connect. Never throws: the release is out either way.
 */
async function applyWhatToTest(store: { api: AppStoreConnect, appId: string }, tag: string, notes: string, locales: string[], minutes: number): Promise<boolean> {
  try {
    const { version, number } = buildNumberOf(tag)
    if (minutes > 0)
      log.info(`Waiting up to ${minutes} min for TestFlight build ${number} to reach App Store Connect…`)
    const build = await waitForBuild(store.api, store.appId, version, number, {
      timeoutMs: minutes * 60_000,
      onWait: elapsed => log.debug(`TestFlight build ${number} not there yet (${Math.round(elapsed / 1000)}s)`),
    })
    if (!build) {
      log.warn(`TestFlight build ${number} is not in App Store Connect yet; once it is, run \`buddy release:notes ${tag} --testflight\`.`)
      return false
    }
    const text = fitNotes(notes, TESTFLIGHT_NOTES_LIMIT)
    await store.api.setWhatToTest(build.id, Object.fromEntries(locales.map(locale => [locale, text])))
    log.info(`Set What to Test on TestFlight build ${number} (${locales.join(', ')})`)
    return true
  }
  catch (error) {
    log.warn(`Could not set What to Test: ${error instanceof Error ? error.message : String(error)}. Retry with \`buddy release:notes ${tag} --testflight\`.`)
    return false
  }
}

async function deliverTestFlight(store: { api: AppStoreConnect, appId: string }, tag: string, notes: string | undefined, locales: string[], minutes: number, groups: string[], keep: number): Promise<boolean> {
  const { version, number } = buildNumberOf(tag)
  try {
    const build = await store.api.deliverBuild(store.appId, version, number, {
      timeoutMs: minutes * 60_000, groups, keepBuilds: keep,
      notes: notes === undefined ? undefined : Object.fromEntries(locales.map(locale => [locale, fitNotes(notes, TESTFLIGHT_NOTES_LIMIT)])),
      onWait: elapsed => log.debug(`TestFlight build ${number} is not ready for its testers (${Math.round(elapsed / 1000)}s)`),
    })
    if (build) {
      log.info(`TestFlight build ${number} is IN_BETA_TESTING${groups.length ? ` for ${groups.join(', ')}` : ''}; older build retention is complete`)
      return true
    }
    log.warn(`TestFlight build ${number} is not available to its testers yet. Older builds remain available. Resume with \`buddy release:testflight ${tag} --wait\`.`)
  }
  catch (error) {
    log.warn(`TestFlight delivery is incomplete: ${error instanceof Error ? error.message : String(error)}. Resume with \`buddy release:testflight ${tag} --wait\`.`)
  }
  return false
}

/** The GitHub release's opening: which build, then what to test in it. */
function githubSummary(summary: string, notes: string): string {
  return `${summary.trim()}\n\n## What to Test\n\n${notes.trim()}`
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
  if (!options.dryRun)
    await assertPublicationAllowed({ cwd: root, channel: 'ios' })
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
  if (!options.dryRun) {
    git('pull', '--quiet', '--rebase', 'origin', 'main')
    git('fetch', '--quiet', '--tags', 'origin')
    // Synchronization can introduce different content and a stricter policy.
    // Validate that tree before building, tagging or contacting the store.
    await assertPublicationAllowed({ cwd: root, channel: 'ios' })
  }

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
  const wait = waitMinutes(options.wait)
  const mobile = await loadMobileConfig(configPath)
  const credentials = appStoreConnectCredentials()
  let store: { api: AppStoreConnect, appId: string } | null = null
  let numberedByXcodeCloud = false
  if (credentials) {
    const bundleId = mobile.ios?.bundleId
    if (!bundleId)
      throw new Error('config/mobile.ts declares no ios.bundleId')
    const api = await AppStoreConnect.connect(credentials)
    store = { api, appId: await api.appId(bundleId) }
    const latestRun = await api.latestXcodeCloudRun(store.appId)
    if (latestRun !== null) {
      tag = nextBuildTag(version, existingTags, latestRun)
      numberedByXcodeCloud = true
    }
  }
  else {
    log.warn('No App Store Connect API key (APP_STORE_CONNECT_KEY_ID, _ISSUER_ID, _PRIVATE_KEY_PATH): the tag counts releases, not the build number TestFlight will show, and older builds stay listed.')
  }

  log.info(`Releasing ${tag}${version === current ? '' : ` (version ${current} → ${version})`}`)
  const keep = retainedBuildCount(options.keepBuilds)
  const groups = mobile.ios?.testFlightGroups ?? []
  if (!Array.isArray(groups)) throw new Error('ios.testFlightGroups must be an array of existing internal group names')
  if (groups.length && !store) throw new Error('ios.testFlightGroups requires an App Store Connect API key')
  if (store) await store.api.internalTestFlightGroups(store.appId, groups)
  // With a key, the tag's number is the Xcode Cloud run, so TestFlight's.
  const summary = iosReleaseSummary(tag, { numberedByXcodeCloud })

  // What testers are told: the commits since the previous build, unless a
  // person said it themselves (--notes, RELEASE_NOTES, config/mobile.ts).
  const releaseConfig = mobile.release ?? {}
  const previous = previousMobileTag(root, 'HEAD')
  const commits = commitsBetween(root, previous, 'HEAD')
  const generateOptions = { types: releaseConfig.noteTypes, excludeScopes: releaseConfig.excludeScopes }
  const notes = resolveNotes({ cwd: root, flags: options, config: releaseConfig, generate: () => testerNotes(commits, generateOptions) })
  const githubNotes = notes.source === 'generated' ? (testerNotes(commits, { ...generateOptions, markdown: true }) || NO_VISIBLE_CHANGES) : notes.text
  const locales = notesLocales(mobile)
  const origin = notes.source === 'generated' ? `${commits.length} commits since ${previous ?? 'the first commit'}` : ({ flag: '--notes', env: 'RELEASE_NOTES', config: 'config/mobile.ts release.notes' } as const)[notes.source]
  if (wait !== null && !numberedByXcodeCloud)
    log.warn('--wait needs an App Store Connect API key and an Xcode Cloud product to know the TestFlight build; Xcode Cloud still reads the What to Test file.')

  if (options.dryRun) {
    log.info(`What to Test (${origin}; ${locales.map(locale => `TestFlight/WhatToTest.${locale}.txt`).join(', ')}):\n\n${fitNotes(notes.text, XCODE_CLOUD_NOTES_LIMIT)}`)
    if (store) {
      const retiring = buildsToExpire(await store.api.builds(store.appId), keep)
      log.info(retiring.length ? `After the new build is available to its testers, would expire TestFlight builds ${retiring.map(b => b.number).join(', ')}` : 'No TestFlight builds to expire')
    }
    if (!options.skipGithubRelease) {
      const preview = await publishGitHubRelease({ cwd: root, tag, ref: 'HEAD', name: summary.name, summary: githubSummary(summary.body, githubNotes), dryRun: true })
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

  // Dev-shell overrides stay out of a release build. Deleting them here is
  // not enough on its own: the build is a child process, and Bun and the env
  // loader both read them back out of .env, so the child is told to withhold
  // them as well (#3028).
  const devOverrides = ['MOBILE_URL', 'IOS_APP_VERSION', 'IOS_BUILD_NUMBER']
  for (const key of devOverrides)
    delete process.env[key]
  const result = await runAction(Action.BuildIos, { env: { ...withholdEnv(devOverrides), NODE_ENV: 'production' } })
  if (resultFailed(result))
    throw result.error ?? new Error('the iOS build failed')

  // The artifact itself, whatever produced it: a release that would talk to
  // a laptop stops before anything is committed, tagged or pushed.
  const craftConfigPath = join(root, IOS_PROJECT_DIR, 'craft.config.json')
  if (existsSync(craftConfigPath)) {
    const problem = unreleasableSite(JSON.parse(readFileSync(craftConfigPath, 'utf8')) as { devServerURL?: unknown })
    if (problem)
      throw new Error(`${problem}. Set ios.url in config/mobile.ts to the production site. Nothing was committed, tagged or pushed; restore the build output and any version bump with \`git checkout -- ${paths.join(' ')}\`.`)
  }

  // Xcode Cloud reads TestFlight/WhatToTest.<locale>.txt beside the project
  // when it uploads the build, so the notes ride in the release commit.
  const written = writeWhatToTest(root, IOS_PROJECT_DIR, notes.text, locales)
  log.info(`What to Test from ${origin}: ${written.join(', ')}`)

  git('add', '--', ...paths)
  if (git('diff', '--cached', '--name-only'))
    git('commit', '--quiet', '-m', `chore(release): ${tag}`)
  pushIosReleaseTag(root, tag)

  // The tag's GitHub release: the changes since the previous one, and which
  // TestFlight build it becomes. A failure here is reported, not thrown: the
  // tag is out and Xcode Cloud is already building it.
  if (!options.skipGithubRelease) {
    const published = await publishGitHubRelease({ cwd: root, tag, name: summary.name, summary: githubSummary(summary.body, githubNotes) })
    if (published.status === 'failed')
      log.warn(describeGitHubRelease(tag, published))
    else
      log.info(describeGitHubRelease(tag, published))
  }

  // Upload/processing alone does not make a build installable. Keep existing
  // builds until the replacement is actually available to its testers.
  if (store) {
    if (wait !== null && numberedByXcodeCloud) {
      if (!await deliverTestFlight(store, tag, notes.text, locales, wait, groups, keep)) process.exitCode = ExitCode.FatalError
    }
    else log.info(`Older TestFlight builds are retained. Complete tester delivery with \`buddy release:testflight ${tag} --wait\`.`)
  }
  return tag
}

interface ReleaseNotesCommandOptions {
  from?: string
  play?: boolean
  markdown?: boolean
  testflight?: boolean
  wait?: boolean | number | string
  notes?: string
  notesFile?: string
}

/**
 * `buddy release:notes [tag]`: the tester notes of a mobile release tag, on
 * stdout (`--play` for Google Play's 500 characters), or set as its TestFlight
 * build's What to Test (`--testflight`).
 */
/**
 * The notes a pushed mobile tag shipped with: the What to Test its release
 * commit carries when a person wrote it, else generated again from the commits
 * since the build tag before it (in full, not cut to the file's size).
 */
function notesForTag(root: string, tag: string, mobile: MobileReleaseSettings, options: ReleaseNotesCommandOptions): { text: string, plain: string } {
  const releaseConfig = mobile.release ?? {}
  const generateOptions = { types: releaseConfig.noteTypes, excludeScopes: releaseConfig.excludeScopes }
  const from = options.from || previousMobileTag(root, `${tag}^`)
  const commits = commitsBetween(root, from, tag)
  const plainGenerated = testerNotes(commits, generateOptions) || NO_VISIBLE_CHANGES
  // A release whose notes were written by hand committed them: keep those,
  // unless --from asks for the commits again.
  const committed = options.from ? null : committedWhatToTest(root, tag, IOS_PROJECT_DIR)
  const handWritten = committed && committed.trim() !== fitNotes(plainGenerated, XCODE_CLOUD_NOTES_LIMIT) ? committed.trim() : null
  const notes = resolveNotes({ cwd: root, flags: options, config: releaseConfig, generate: () => handWritten ?? plainGenerated })
  if (notes.source !== 'generated' || handWritten)
    return { text: notes.text, plain: notes.text }
  return { text: options.markdown ? testerNotes(commits, { ...generateOptions, markdown: true }) || NO_VISIBLE_CHANGES : plainGenerated, plain: plainGenerated }
}

async function releaseNotesCommand(tagArgument: string | undefined, options: ReleaseNotesCommandOptions): Promise<void> {
  const root = process.cwd()
  const configPath = join(root, 'config/mobile.ts')
  const mobile = existsSync(configPath) ? await loadMobileConfig(configPath) : {}
  const tag = tagArgument || previousMobileTag(root, 'HEAD')
  if (!tag || !git('tag', '--list', tag))
    throw new Error(tagArgument ? `there is no tag ${tagArgument}` : 'there is no mobile release tag (v*-build.*) yet')
  const notes = notesForTag(root, tag, mobile, options)

  if (options.testflight) {
    const credentials = appStoreConnectCredentials()
    if (!credentials)
      throw new Error('--testflight needs an App Store Connect API key (APP_STORE_CONNECT_KEY_ID, _ISSUER_ID, _PRIVATE_KEY_PATH)')
    const bundleId = mobile.ios?.bundleId
    if (!bundleId)
      throw new Error('config/mobile.ts declares no ios.bundleId')
    const api = await AppStoreConnect.connect(credentials)
    const store = { api, appId: await api.appId(bundleId) }
    if (!await applyWhatToTest(store, tag, notes.plain, notesLocales(mobile), waitMinutes(options.wait) ?? 0))
      process.exitCode = ExitCode.FatalError
    return
  }

  const limit = options.play ? PLAY_NOTES_LIMIT : options.markdown ? Number.POSITIVE_INFINITY : TESTFLIGHT_NOTES_LIMIT
  await printAsync(Number.isFinite(limit) ? fitNotes(notes.text, limit) : notes.text)
}

async function releaseTestFlightCommand(tagArgument: string | undefined, options: IosReleaseOptions): Promise<void> {
  const root = process.cwd()
  if (!options.dryRun) await assertPublicationAllowed({ cwd: root, channel: 'ios' })
  const mobile = await loadMobileConfig(join(root, 'config/mobile.ts'))
  const tag = tagArgument || previousMobileTag(root, 'HEAD')
  if (!tag || !git('tag', '--list', tag)) throw new Error('Select an existing mobile release tag')
  buildNumberOf(tag)
  const credentials = appStoreConnectCredentials()
  if (!credentials || !mobile.ios?.bundleId) throw new Error('TestFlight delivery needs an App Store Connect API key and ios.bundleId')
  const api = await AppStoreConnect.connect(credentials)
  const store = { api, appId: await api.appId(mobile.ios.bundleId) }
  const groups = mobile.ios.testFlightGroups ?? []
  await api.internalTestFlightGroups(store.appId, groups)
  const keep = retainedBuildCount(options.keepBuilds)
  if (options.dryRun) {
    log.info(`Would deliver ${tag}${groups.length ? ` to ${groups.join(', ')}` : ' using its existing internal tester access'}, confirm IN_BETA_TESTING, then retain ${keep} older builds. Nothing was distributed or expired.`)
    return
  }
  // Delivery resumes preserve the build's already approved localized notes.
  // `release:notes --testflight` remains the explicit notes-editing command.
  if (!await deliverTestFlight(store, tag, undefined, notesLocales(mobile), waitMinutes(options.wait) ?? DEFAULT_WAIT_MINUTES, groups, keep))
    process.exitCode = ExitCode.FatalError
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
    .option('--keep-builds <n>', 'Older TestFlight builds to retain after the replacement is available to testers (needs an App Store Connect API key)', { default: 1 })
    .option('--skip-github-release', descriptions.skipGithubRelease, { default: false })
    .option('--notes <text>', 'What to Test for this build, instead of the notes generated from the commits since the previous build')
    .option('--notes-file <path>', 'Read What to Test from a file (also RELEASE_NOTES / RELEASE_NOTES_FILE, or release.notes in config/mobile.ts)')
    .option('--wait [minutes]', 'Wait for processing, notes and configured internal TestFlight group delivery (default 60 minutes; needs an App Store Connect API key)')
    .option('--dry-run', descriptions.dryRun, { default: false })
    .action(async (options: IosReleaseOptions) => {
      const startTime = await intro('buddy release:ios')
      try {
        const tag = await releaseIos(options)
        await outro(options.dryRun ? `Dry run complete: would release ${tag}` : process.exitCode ? `Published ${tag}; TestFlight delivery is incomplete` : `Released ${tag}`, { startTime, useSeconds: true })
        if (!options.dryRun)
          log.info('A CI that builds tags (Xcode Cloud: Tag Changes, prefix "v") turns it into a TestFlight build now.')
      }
      catch (error) {
        await log.error('Failed to release the iOS app', error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('release:testflight [tag]', 'Complete internal tester delivery for an existing iOS release tag')
    .option('--wait [minutes]', 'Wait for processing and tester availability (default 60 minutes)')
    .option('--keep-builds <n>', 'Older builds to retain after tester delivery succeeds', { default: 1 })
    .option('--dry-run', descriptions.dryRun, { default: false })
    .action(async (tag: string | undefined, options: IosReleaseOptions) => {
      try { await releaseTestFlightCommand(tag, options) }
      catch (error) {
        await log.error('Failed to deliver the TestFlight build', error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('release:notes [tag]', 'Print the tester notes of a mobile release tag (default: the newest v*-build.* tag), or set them as its TestFlight What to Test')
    .option('--from <ref>', 'Generate from the commits since this ref instead of the previous build tag')
    .option('--play', 'Fit the notes to Google Play\'s 500-character What\'s new', { default: false })
    .option('--markdown', 'Markdown, as the GitHub release shows the notes', { default: false })
    .option('--testflight', 'Set the notes as the TestFlight build\'s What to Test through App Store Connect', { default: false })
    .option('--wait [minutes]', 'With --testflight: wait this long for the build to appear (default 60)')
    .option('--notes <text>', 'Use this text instead')
    .option('--notes-file <path>', 'Read the text from a file instead')
    .action(async (tag: string | undefined, options: ReleaseNotesCommandOptions) => {
      try {
        await releaseNotesCommand(tag, options)
      }
      catch (error) {
        await log.error('Failed to produce the release notes', error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('release:github [tag]', 'Create the GitHub release for a pushed tag (default: the newest), with the changes since the tag before it')
    .option('--dry-run', 'Print the release instead of creating it', { default: false })
    .action(async (tag: string | undefined, options: { dryRun?: boolean }) => {
      const startTime = await intro('buddy release:github')
      try {
        if (!options.dryRun)
          await assertPublicationAllowed({ cwd: process.cwd(), channel: 'github-release' })
        const target = tag || git('describe', '--tags', '--abbrev=0')
        if (!git('tag', '--list', target))
          throw new Error(`there is no tag ${target}`)
        // An iOS build tag gets the same title and TestFlight line release:ios gives it.
        const ios = /^v\d+\.\d+\.\d+-build\.\d+$/.test(target)
          ? iosReleaseSummary(target, { numberedByXcodeCloud: appStoreConnectCredentials() !== null })
          : null
        let summary = ios?.body
        if (ios) {
          const configPath = join(process.cwd(), 'config/mobile.ts')
          const mobile = existsSync(configPath) ? await loadMobileConfig(configPath) : {}
          summary = githubSummary(ios.body, notesForTag(process.cwd(), target, mobile, { markdown: true }).text)
        }
        const result = await publishGitHubRelease({ cwd: process.cwd(), tag: target, name: ios?.name, summary, dryRun: options.dryRun })
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

  buddy
    .command('release:verify <plan>', 'Verify exact source gates, published archives and installed consumer checks')
    .option('--output <path>', 'Save the successful verification receipt as JSON')
    .action(async (planPath: string, options: { output?: string }) => {
      let temporary: string | undefined
      try {
        const plan: unknown = JSON.parse(readFileSync(planPath, 'utf8'))
        validateReleaseEvidencePlan(plan)
        const receipt = await verifyReleaseEvidence(plan, { cwd: process.cwd(), token: resolveGitHubToken() ?? undefined })
        const json = `${JSON.stringify(receipt, null, 2)}\n`
        if (options.output) {
          temporary = `${options.output}.${crypto.randomUUID()}.tmp`
          writeFileSync(temporary, json, { flag: 'wx', mode: 0o600 })
          renameSync(temporary, options.output)
          temporary = undefined
          await printAsync(`Verified release evidence saved to ${options.output}`)
        }
        else {
          await printAsync(json.trimEnd())
        }
      }
      catch (error) {
        if (temporary) rmSync(temporary, { force: true })
        await log.error('Release verification failed', error)
        process.exitCode = ExitCode.FatalError
      }
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
