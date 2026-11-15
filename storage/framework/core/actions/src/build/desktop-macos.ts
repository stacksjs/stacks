import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import type { MacosBuildRecord, MacosDistribution } from '@stacksjs/desktop-build'
import { assembleMacosApp, developerIdProblem, findDeveloperIdIdentity, findDevelopmentIdentity, loadMacosDesktop, macosBuildRecordFile, macosSelfUpdates, renderAgentEntry } from '@stacksjs/desktop-build'
import { projectPath } from '@stacksjs/path'
import { macosAgentDevFiles, macosAgentDevManifest, macosAgentEntry, prepareMacosAgent, prepareMacosNative } from './macos-native'

/**
 * `buddy build:desktop` for a project whose `config/desktop.ts` declares a
 * `macos` app: the screens and AppKit host (macos-native.ts), then
 * `<App>.app`, signed. `STACKS_DESKTOP_LAUNCH=1` (`buddy dev:desktop`) opens it.
 *
 * With `macos.agent`, `buddy dev:desktop` builds no bundle: it runs the agent
 * launcher from source in the project, which serves the app's routes and
 * spawns the host, so a route edit is one relaunch away. The bundle's
 * executable is that launcher compiled, with the host beside it.
 *
 * `DESKTOP_DISTRIBUTION=developer-id` (`buddy release:desktop`, `buddy
 * build:dmg` with an identity) builds the copy people download: signed with a
 * Developer ID Application certificate, never sandboxed, with the updater in
 * its host when the app has `macos.updates`. The identity is
 * `DESKTOP_SIGNING_IDENTITY`, else `APPLE_SIGNING_IDENTITY` (what Pantry's
 * native pipeline exports), else the Developer ID certificate in the keychain.
 */
process.exitCode = 1

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadMacosDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no macos section. Add one, or build the Craft web-view app with `buddy build:desktop` without it.')

const requested = process.env.DESKTOP_DISTRIBUTION || 'development'
if (requested !== 'development' && requested !== 'developer-id')
  throw new Error(`DESKTOP_DISTRIBUTION is "${requested}". It is development or developer-id; the Mac App Store app is \`buddy desktop:apple:package\`.`)
const distribution: MacosDistribution = requested
const launching = process.env.STACKS_DESKTOP_LAUNCH === '1'
if (distribution === 'developer-id' && launching)
  throw new Error('A Developer ID build is what a release ships, not what `buddy dev:desktop` runs. Unset DESKTOP_DISTRIBUTION.')
// A rehearsal lays the release out without the certificate: `release:desktop
// --dry-run`, and `--package-only` where no identity was given, which is how
// Pantry's native pipeline checks a pull request (it has no certificate there,
// and refuses anything but a Developer ID signature when it releases).
const packageOnly = process.env.DESKTOP_RELEASE_PACKAGE_ONLY === '1'
const rehearsal = distribution === 'developer-id' && (process.env.DESKTOP_RELEASE_DRY_RUN === '1' || packageOnly)

const prepared = await prepareMacosNative(config, { root, distribution })

if (config.agent && launching) {
  const files = macosAgentDevFiles(prepared)
  writeFileSync(files.entry, renderAgentEntry({ agentEntry: macosAgentEntry(root, config) }))
  writeFileSync(files.manifest, `${JSON.stringify(macosAgentDevManifest(config, prepared), null, 2)}\n`)
  await log.info(`Starting ${config.appName} with its agent (Ctrl-C quits)`)
  const child = Bun.spawn(['bun', files.entry], { cwd: root, env: { ...process.env, STACKS_DESKTOP_AGENT_MANIFEST: files.manifest }, stdio: ['inherit', 'inherit', 'inherit'] })
  process.exitCode = await child.exited
  process.exit()
}

const agent = config.agent ? await prepareMacosAgent(config, prepared, distribution) : undefined
// A local run is unsandboxed (DESKTOP_SANDBOX=1 builds it sandboxed): without a
// provisioning profile it cannot hold the Keychain access group the Store build has.
// `desktop:apple:package` builds the sandboxed, Store-signed one.
//
// Signed with an Apple Development identity when the Mac has one, else ad hoc.
// A stable certificate keeps the Keychain item trusted across rebuilds; an ad hoc
// signature changes with every build and stops the next launch on a Keychain prompt.
//
// A Developer ID build is signed with the certificate it ships under, and is
// never sandboxed: an app that updates itself replaces its own bundle.
const identity = distribution === 'developer-id'
  ? process.env.DESKTOP_SIGNING_IDENTITY || process.env.APPLE_SIGNING_IDENTITY || findDeveloperIdIdentity() || (rehearsal ? '-' : undefined)
  : process.env.DESKTOP_SIGNING_IDENTITY || process.env.APPLE_DEVELOPMENT_IDENTITY || findDevelopmentIdentity() || '-'
if (!identity)
  throw new Error('A Developer ID build needs a Developer ID Application certificate, and this keychain has none. Pass --identity (or DESKTOP_SIGNING_IDENTITY) with its name or hash; https://developer.apple.com/account/resources/certificates issues one.')
const sandboxed = distribution === 'development' && process.env.DESKTOP_SANDBOX === '1'
const assembled = assembleMacosApp({
  config, root, host: prepared.host, nativeBundle: prepared.nativeBundle, output: prepared.output, distribution, signingIdentity: identity, unsandboxed: !sandboxed, agent, rehearsal,
})
for (const note of assembled.notes) await log.warn(note)
for (const key of assembled.ignoredPlistKeys) await log.warn(`macos.infoPlist: ${key} is set by the build and was ignored`)
if (distribution === 'developer-id') {
  if (process.env.DESKTOP_SANDBOX === '1')
    await log.warn('DESKTOP_SANDBOX is ignored: a Developer ID build is not sandboxed, so the app can replace its own bundle when it updates.')
  if (rehearsal && identity === '-') {
    await log.warn(packageOnly
      ? 'Signed ad hoc: no signing identity was given and this keychain has no Developer ID Application certificate. Good for a check; no other Mac opens it, and Pantry refuses to release it.'
      : 'Signed ad hoc for the dry run: there is no Developer ID Application certificate here. The release itself needs one.')
  }
  else {
    // Said now, in the build, rather than by Apple's notary service minutes later.
    const signature = Bun.spawnSync(['codesign', '-dvv', assembled.appPath], { stderr: 'pipe' })
    const problem = developerIdProblem(`${signature.stdout.toString()}${signature.stderr.toString()}`)
    if (problem) throw new Error(`${assembled.appPath} is not a Developer ID build: ${problem} It was signed with "${identity}".`)
  }
}
const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'ignore' })
const record: MacosBuildRecord = {
  appName: config.appName, bundleId: config.bundleId, version: config.version, buildNumber: config.buildNumber, url: config.agent ? null : config.url, agent: Boolean(config.agent), webkit: config.webkit === true,
  host: { key: prepared.hostKey, sha256: createHash('sha256').update(readFileSync(prepared.host)).digest('hex') },
  signedWith: identity === '-' ? 'ad hoc' : identity,
  sandboxed,
  distribution,
  updater: prepared.updater && macosSelfUpdates(config, distribution),
  architecture: process.arch,
  sourceRevision: revision.exitCode === 0 ? revision.stdout.toString().trim() : null,
}
writeFileSync(macosBuildRecordFile(prepared.output, config.appName), `${JSON.stringify(record, null, 2)}\n`)

await log.success(`Built ${assembled.appPath}`)
if (launching) {
  await log.info(config.agent ? `Opening ${config.appName} with its agent` : `Opening ${config.appName} against ${config.url}`)
  Bun.spawn(['open', '-n', assembled.appPath], { stdout: 'inherit', stderr: 'inherit' })
}
process.exitCode = 0
