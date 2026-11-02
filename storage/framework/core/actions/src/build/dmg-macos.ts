import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { log, parseOptions } from '@stacksjs/cli'
import { developerIdProblem, loadMacosDesktop, macosOutputDirectory, resolveDmgPackaging } from '@stacksjs/desktop-build'
import { projectPath, storagePath } from '@stacksjs/path'
import { imageDmg, notarizeAndStaple, notaryArguments } from './notarize'
import { runBuildStep } from './run-build-step'

/**
 * `buddy build:dmg` for a project whose `config/desktop.ts` declares a `macos`
 * app: build `<App>.app` the way `build:desktop` does (build/desktop-macos.ts),
 * signed with the Developer ID identity given, notarize and staple it, then
 * image it into a signed, notarized DMG.
 *
 * `build/dmg.ts` packages the Craft web-view app from `build:desktop`'s
 * manifest, which a `macos` app never writes, so this command used to build
 * the wrong kind of app for one (or fail looking for Craft's CLI).
 *
 * The bundle is always rebuilt: it has to be signed with the identity this
 * run was given, and a stale one signed for development would be notarized
 * as whatever it happened to be. The app's name, bundle id and version come
 * from `config/desktop.ts`, which the bundle was built from.
 */

if (process.platform !== 'darwin')
  throw new Error('DMG packaging only runs on macOS')

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadMacosDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no macos section, so build:dmg packages the Craft web-view app instead.')

const flags = parseOptions() as Record<string, unknown>
for (const [flag, name] of [['appName', '--app-name'], ['bundleId', '--bundle-id'], ['appVersion', '--app-version']] as const) {
  if (flags[flag] !== undefined)
    await log.warn(`${name} is ignored: config/desktop.ts names, identifies and versions a macos app.`)
}
const { volumeName, signingIdentity, notary } = resolveDmgPackaging({
  flags: { ...flags, appName: undefined, bundleId: undefined, appVersion: undefined },
  env: { ...process.env, DESKTOP_APP_NAME: undefined, DESKTOP_BUNDLE_ID: undefined, DESKTOP_APP_VERSION: undefined },
  manifestTitle: config.appName,
  declaredVersion: config.version,
})
if (notary && !signingIdentity)
  throw new Error('Notarizing needs a Developer ID identity (--signing-identity or DESKTOP_SIGNING_IDENTITY): Apple only notarizes signed code.')

// build/desktop-macos.ts signs with DESKTOP_SIGNING_IDENTITY when it is set.
if (signingIdentity) process.env.DESKTOP_SIGNING_IDENTITY = signingIdentity
await import('./desktop-macos')

const app = join(macosOutputDirectory(root, config), `${config.appName}.app`)
if (!existsSync(app)) throw new Error(`build:desktop did not produce ${app}`)

// Apple rejects anything not signed with Developer ID after a wait of minutes;
// the signature says so now.
if (notary) {
  const signature = Bun.spawnSync(['codesign', '-dvv', app], { stderr: 'pipe' })
  const problem = developerIdProblem(`${signature.stdout.toString()}${signature.stderr.toString()}`)
  if (problem) throw new Error(`${app} cannot be notarized: ${problem}`)
}

const outputDir = storagePath('framework/desktop-dmg')
rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

// hdiutil images the staging folder wholesale, so only the app goes there;
// the notarization zip goes to scratch.
const staging = mkdtempSync(join(tmpdir(), 'stacks-dmg-'))
const scratch = mkdtempSync(join(tmpdir(), 'stacks-dmg-work-'))
process.on('exit', () => {
  rmSync(staging, { recursive: true, force: true })
  rmSync(scratch, { recursive: true, force: true })
})

const auth = notary && notaryArguments(notary)
if (auth) await notarizeAndStaple(app, `${config.appName}.app`, auth, scratch)

// ditto, not cp: it keeps the signature, extended attributes and stapled ticket.
await runBuildStep(['ditto', app, join(staging, `${config.appName}.app`)], { cwd: staging, describe: `Staging ${config.appName}.app` })

const dmgPath = join(outputDir, `${config.appName}-${config.version}.dmg`)
await imageDmg({ staging, volumeName, dmgPath, signingIdentity })
if (auth) {
  await notarizeAndStaple(dmgPath, 'the DMG', auth, scratch)
  await log.success('Notarized and stapled')
}

await log.success(`Built ${dmgPath}`)
if (!signingIdentity)
  await log.info('Signed for development only: other Macs refuse it. Pass --signing-identity with a Developer ID identity, and --notarize, before distributing.')
else if (!auth)
  await log.info('Signed but not notarized: other Macs still warn on first open. Pass --notary-profile, or --notarize with an App Store Connect API key.')
