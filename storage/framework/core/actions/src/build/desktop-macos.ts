import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { assembleMacosApp, findDevelopmentIdentity, loadMacosDesktop, renderAgentEntry } from '@stacksjs/desktop-build'
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
 */
process.exitCode = 1

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadMacosDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no macos section. Add one, or build the Craft web-view app with `buddy build:desktop` without it.')

const prepared = await prepareMacosNative(config, { root })

if (config.agent && process.env.STACKS_DESKTOP_LAUNCH === '1') {
  const files = macosAgentDevFiles(prepared)
  writeFileSync(files.entry, renderAgentEntry({ agentEntry: macosAgentEntry(root, config) }))
  writeFileSync(files.manifest, `${JSON.stringify(macosAgentDevManifest(config, prepared), null, 2)}\n`)
  await log.info(`Starting ${config.appName} with its agent (Ctrl-C quits)`)
  const child = Bun.spawn(['bun', files.entry], { cwd: root, env: { ...process.env, STACKS_DESKTOP_AGENT_MANIFEST: files.manifest }, stdio: ['inherit', 'inherit', 'inherit'] })
  process.exitCode = await child.exited
  process.exit()
}

const agent = config.agent ? await prepareMacosAgent(config, prepared, 'development') : undefined
// A local run is unsandboxed (DESKTOP_SANDBOX=1 builds it sandboxed): without a
// provisioning profile it cannot hold the Keychain access group the Store build has.
// `desktop:apple:package` builds the sandboxed, Store-signed one.
//
// Signed with an Apple Development identity when the Mac has one, else ad hoc.
// A stable certificate keeps the Keychain item trusted across rebuilds; an ad hoc
// signature changes with every build and stops the next launch on a Keychain prompt.
const identity = process.env.DESKTOP_SIGNING_IDENTITY || process.env.APPLE_DEVELOPMENT_IDENTITY || findDevelopmentIdentity() || '-'
const assembled = assembleMacosApp({
  config, root, host: prepared.host, nativeBundle: prepared.nativeBundle, output: prepared.output, distribution: 'development', signingIdentity: identity, unsandboxed: process.env.DESKTOP_SANDBOX !== '1', agent,
})
for (const note of assembled.notes) await log.warn(note)
for (const key of assembled.ignoredPlistKeys) await log.warn(`macos.infoPlist: ${key} is set by the build and was ignored`)
writeFileSync(join(prepared.output, `${config.appName}.build.json`), `${JSON.stringify({
  appName: config.appName, bundleId: config.bundleId, version: config.version, buildNumber: config.buildNumber, url: config.agent ? null : config.url, agent: Boolean(config.agent), webkit: config.webkit === true,
  host: { key: prepared.hostKey, sha256: createHash('sha256').update(readFileSync(prepared.host)).digest('hex') },
  signedWith: identity === '-' ? 'ad hoc' : identity,
  sandboxed: process.env.DESKTOP_SANDBOX === '1',
}, null, 2)}\n`)

await log.success(`Built ${assembled.appPath}`)
if (process.env.STACKS_DESKTOP_LAUNCH === '1') {
  await log.info(config.agent ? `Opening ${config.appName} with its agent` : `Opening ${config.appName} against ${config.url}`)
  Bun.spawn(['open', '-n', assembled.appPath], { stdout: 'inherit', stderr: 'inherit' })
}
process.exitCode = 0
