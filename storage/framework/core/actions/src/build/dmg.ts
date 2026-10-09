import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { appPath, projectPath, publicPath, resourcesPath, storagePath } from '@stacksjs/path'
import { bundleDirectoryFor, codesignArgs, describeRuntimeDuplication, dmgVolumeName, looksLikeBunExecutable, renderUserlandPlistEntries } from '@stacksjs/desktop-build'
import { runBuildStep } from './run-build-step'

/**
 * Package the `build:desktop` output as a macOS `.app` inside a `.dmg`.
 *
 * `build:desktop` emits a launcher, the Craft runtime, and a manifest — the
 * pieces, not something a person can double-click. This wraps them in a real
 * bundle and a mountable disk image.
 *
 * The result is UNSIGNED unless a Developer ID identity is supplied, so
 * Gatekeeper will refuse it on first open (right-click → Open, once). Set
 * `DESKTOP_SIGNING_IDENTITY` to sign (a certificate name, or its SHA-1 when two
 * share a name), and `DESKTOP_NOTARY_PROFILE` - a `xcrun notarytool
 * store-credentials` keychain profile - to notarize and staple the DMG so it
 * opens without a warning on other Macs. `app/Desktop/Entitlements.plist`, if
 * present, is applied to every executable.
 */

if (process.platform !== 'darwin')
  throw new Error('DMG packaging only runs on macOS')

const desktopDist = storagePath('framework/desktop-dist')
const manifestPath = join(desktopDist, 'desktop.json')
if (!existsSync(manifestPath))
  throw new Error('Run `buddy build:desktop` before packaging a DMG')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  title?: string
  url?: string
  launcher?: 'framework' | 'userland'
}
const ownsLauncher = manifest.launcher === 'userland'
const appName = process.env.DESKTOP_APP_NAME || manifest.title || process.env.APP_NAME || 'Stacks'
const bundleId = process.env.DESKTOP_BUNDLE_ID || `sh.stacks.${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const version = process.env.DESKTOP_APP_VERSION || '0.0.0'
const signingIdentity = process.env.DESKTOP_SIGNING_IDENTITY
const notaryProfile = process.env.DESKTOP_NOTARY_PROFILE

const outputDir = storagePath('framework/desktop-dmg')
if (existsSync(outputDir)) rmSync(outputDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

// Build the bundle in a staging dir; hdiutil images the whole directory, so
// only the .app may live there.
const staging = mkdtempSync(join(tmpdir(), 'stacks-dmg-'))
// Scratch space kept OUT of the staged folder: hdiutil images that directory
// wholesale, so anything left there ships inside the DMG next to the app.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-dmg-work-'))

/**
 * Remove both temp directories, however this process ends
 * (stacksjs/stacks#2885).
 *
 * They used to be removed only after `hdiutil create` succeeded, so every
 * failed run left the staged bundle behind - about 90 MB a time. A repeatable
 * imaging failure (stacksjs/stacks#2884) left 74 directories and 3.2 GB on one
 * machine, noticed only because the app in question was a disk cleaner.
 *
 * Registered on `exit` rather than wrapped in try/finally around the imaging
 * step, because the imaging step was never the only leaking path: this file is
 * top-level module code with five throws and several `runBuildStep` calls after
 * the directories exist, and every one of them leaked both. Reproduced from the
 * `build:desktop did not produce` throw, which is 190 lines above the one the
 * issue describes. Bun runs `exit` handlers after a top-level throw, verified
 * before relying on it here.
 *
 * `rmSync` with `force` is idempotent, so the success path below still removes
 * them early - ahead of signing and notarization, which can take minutes - and
 * this runs harmlessly again afterwards.
 */
process.on('exit', () => {
  rmSync(staging, { recursive: true, force: true })
  rmSync(scratch, { recursive: true, force: true })
})
const appDir = join(staging, `${appName}.app`)
const macosDir = join(appDir, 'Contents/MacOS')
const resourcesDir = join(appDir, 'Contents/Resources')
mkdirSync(macosDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

// The launcher resolves its manifest and the Craft runtime relative to its own
// executable, so everything build:desktop emitted goes together in
// Contents/MacOS. Copying the whole directory rather than three names lets an
// app with its own launcher ship the sibling binaries it needs — a server, a
// worker — which a fixed list silently dropped.
const builtLauncher = 'stacks-desktop'

/**
 * The launcher is renamed to the app inside the bundle.
 *
 * macOS names the *process* in every permission prompt, not the bundle: a
 * launcher still called `stacks-desktop` produces "stacks-desktop would like to
 * access files in your Downloads folder", which reads like something the user
 * should refuse — and many will. `build:desktop` keeps the stable name in
 * `desktop-dist` so provenance and checksums do not move; the bundle gets the
 * name a person recognises.
 */
const launcherName = appName

const bundledFiles = readdirSync(desktopDist).filter(name => statSync(join(desktopDist, name)).isFile())
for (const file of bundledFiles) {
  const target = file === builtLauncher ? launcherName : file
  // Executables in MacOS, the manifest and checksums in Resources: codesign
  // treats everything in MacOS as code and refuses to sign beside data.
  const directory = bundleDirectoryFor(join(desktopDist, file)) === 'MacOS' ? macosDir : resourcesDir
  await runBuildStep(['cp', join(desktopDist, file), join(directory, target)], {
    cwd: projectPath(),
    describe: `Copying ${file} into the bundle`,
  })
}

if (!existsSync(join(macosDir, launcherName)))
  throw new Error(`build:desktop did not produce ${builtLauncher}`)

// Every `bun build --compile` output embeds a complete copy of the Bun runtime
// — 60.5 MB before a line of application code. An app that ships its launcher,
// its server and a worker as three binaries therefore ships three copies, and
// nothing tells it: the bundle is simply large, and a large desktop app looks
// unremarkable. One app carried 230 MB that way, of which 180 MB was the same
// runtime repeated. A warning is the right level — an app may have a reason,
// and this is not the build's decision to make.
const runtimes = readdirSync(macosDir)
  .filter(name => statSync(join(macosDir, name)).isFile())
  .filter(name => looksLikeBunExecutable(join(macosDir, name)))
  .map(name => ({ name, bytes: statSync(join(macosDir, name)).size }))

const duplication = describeRuntimeDuplication(runtimes)
if (duplication)
  log.warn(duplication)

// Anything an app puts in `app/Desktop/Resources/` — a prerendered UI, a
// schema, seed data — travels into the bundle. A local-first app has a payload
// to carry and nowhere else to put it.
const userlandResources = appPath('Desktop/Resources')
if (existsSync(userlandResources))
  cpSync(userlandResources, resourcesDir, { recursive: true })

/** Build an .icns from a square PNG, if one is available. */
async function buildIcon(): Promise<string | undefined> {
  const sources = [
    resourcesPath('assets/images/app-icon.png'),
    publicPath('images/app-icon.png'),
    publicPath('apple-touch-icon.png'),
  ]
  const source = sources.find(candidate => existsSync(candidate))
  if (!source) return undefined

  const iconset = join(scratch, 'icon.iconset')
  mkdirSync(iconset, { recursive: true })
  // The sizes iconutil expects; anything missing makes it reject the set.
  for (const size of [16, 32, 128, 256, 512]) {
    await runCommand(['sips', '-z', String(size), String(size), source, '--out', join(iconset, `icon_${size}x${size}.png`)], { cwd: scratch, silent: true })
    await runCommand(['sips', '-z', String(size * 2), String(size * 2), source, '--out', join(iconset, `icon_${size}x${size}@2x.png`)], { cwd: scratch, silent: true })
  }

  const icns = join(resourcesDir, 'AppIcon.icns')
  const built = await runCommand(['iconutil', '-c', 'icns', iconset, '-o', icns], { cwd: scratch })
  // An icon is not worth failing a build over, but a project that supplied one
  // and got a bundle wearing the generic document icon deserves to be told why.
  if (built.isErr || !existsSync(icns)) {
    log.warn(`Could not build an .icns from ${source}; the bundle will use the default icon.`)
    return undefined
  }
  return 'AppIcon'
}

const iconFile = await buildIcon()

/**
 * Extra `Info.plist` entries this application declares, as JSON — the
 * `NS*UsageDescription` strings above all, which are the sentences a person
 * reads in a macOS permission prompt. The serialiser and the reserved-key list
 * live in `@stacksjs/desktop-build` so they can be tested directly.
 */
function readUserlandPlist(): Record<string, unknown> {
  const declared = appPath('Desktop/Info.plist.json')
  if (!existsSync(declared)) return {}

  try {
    return JSON.parse(readFileSync(declared, 'utf8')) as Record<string, unknown>
  }
  catch (error) {
    throw new Error(`app/Desktop/Info.plist.json is not valid JSON: ${error instanceof Error ? error.message : error}`)
  }
}

const declaredPlist = readUserlandPlist()
const { xml: extraPlistEntries, ignored: ignoredPlistKeys } = renderUserlandPlistEntries(declaredPlist)
if (ignoredPlistKeys.length > 0)
  log.info(`Ignoring reserved Info.plist keys from app/Desktop/Info.plist.json: ${ignoredPlistKeys.join(', ')}`)

/**
 * Keys below that the application has taken over.
 *
 * A plist with the same key twice is malformed, and these are exactly the ones
 * an app has reason to set: a utility raising its minimum macOS, or an app
 * needing transport rules of its own. The app's value wins and the default is
 * left out, rather than both being emitted.
 */
function overriddenByApp(key: string): boolean {
  return Object.hasOwn(declaredPlist, key)
}

writeFileSync(join(appDir, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appName}</string>
  <key>CFBundleDisplayName</key><string>${appName}</string>
  <key>CFBundleIdentifier</key><string>${bundleId}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleExecutable</key><string>${launcherName}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
${overriddenByApp('LSMinimumSystemVersion') ? '' : '  <key>LSMinimumSystemVersion</key><string>11.0</string>\n'}${overriddenByApp('NSHighResolutionCapable') ? '' : '  <key>NSHighResolutionCapable</key><true/>\n'}${overriddenByApp('NSAppTransportSecurity')
  ? ''
  : `${ownsLauncher
  ? `  <!-- The window talks to something this app started on loopback, so an
       exception for 127.0.0.1 is all it needs. NSAllowsArbitraryLoads would
       additionally permit every unencrypted host on the internet. -->
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
    <key>NSExceptionDomains</key>
    <dict>
      <key>127.0.0.1</key>
      <dict><key>NSExceptionAllowsInsecureHTTPLoads</key><true/></dict>
    </dict>
  </dict>`
  : `  <!-- The window loads a remote URL, so the app has to be allowed to reach it. -->
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>`}`}${iconFile ? `
  <key>CFBundleIconFile</key><string>${iconFile}</string>` : ''}${extraPlistEntries}
</dict>
</plist>
`)

if (signingIdentity) {
  // Inside-out: every nested executable, then the launcher, then the bundle.
  // Signing the parent first invalidates its seal the moment an inner binary is
  // signed after it — and an app-owned launcher may ship several.
  const nested = readdirSync(macosDir)
    .filter(name => name !== launcherName)
    .map(name => join(macosDir, name))

  // An app's own entitlements - Apple Events for an app that scripts another,
  // say - go on every executable. Re-signing also drops whatever a bundled
  // runtime arrived with: the published Craft binary carries the App Sandbox
  // entitlement, under which it traps at launch outside a sandboxed bundle.
  const declaredEntitlements = appPath('Desktop/Entitlements.plist')
  const entitlements = existsSync(declaredEntitlements) ? declaredEntitlements : undefined

  // A failed `codesign` used to be invisible: the DMG was still built and
  // still announced as signed, and the first sign that it was not came from
  // Gatekeeper on someone else's Mac.
  for (const target of [...nested, join(macosDir, launcherName), appDir]) {
    await runBuildStep(codesignArgs({ identity: signingIdentity, target, entitlements }), {
      cwd: staging,
      describe: `Signing ${basename(target)}`,
    })
  }
}

/**
 * Submit to Apple's notary service, wait, and staple the ticket to `target`.
 * A stapled ticket lets Gatekeeper accept the file offline; the app is
 * notarized on its own as well as in the DMG, because once someone drags it
 * out of the image only the app's own ticket travels with it.
 */
async function notarize(target: string, what: string): Promise<void> {
  if (!signingIdentity)
    throw new Error('DESKTOP_NOTARY_PROFILE needs DESKTOP_SIGNING_IDENTITY: Apple only notarizes signed code.')
  // notarytool takes a zip, dmg or pkg, not a bare .app.
  const upload = target.endsWith('.app') ? join(scratch, `${basename(target)}.zip`) : target
  if (upload !== target)
    await runBuildStep(['ditto', '-c', '-k', '--keepParent', target, upload], { cwd: scratch, describe: `Zipping ${basename(target)} for notarization` })
  log.info(`Notarizing ${what} (Apple usually answers within a few minutes)...`)
  // `--wait` exits 0 for "Invalid" too, so the status line is what decides.
  const submitted = Bun.spawnSync(['xcrun', 'notarytool', 'submit', upload, '--keychain-profile', notaryProfile!, '--wait'], { stderr: 'pipe' })
  const report = `${submitted.stdout.toString()}${submitted.stderr.toString()}`
  const status = report.match(/status: (\w[\w ]*)/g)?.pop()?.replace('status: ', '')
  if (submitted.exitCode !== 0 || status !== 'Accepted') {
    console.error(report.trim())
    const id = report.match(/id: ([0-9a-f-]{36})/)?.[1]
    throw new Error(`Notarization of ${what} ${status ?? 'failed'}${id ? ` - see \`xcrun notarytool log ${id} --keychain-profile ${notaryProfile}\`` : ''}`)
  }
  await runBuildStep(['xcrun', 'stapler', 'staple', target], { cwd: dirname(target), describe: `Stapling the notarization ticket to ${what}` })
}

if (notaryProfile)
  await notarize(appDir, basename(appDir))

// The drag-to-install target every macOS DMG is expected to have.
symlinkSync('/Applications', join(staging, 'Applications'))

const dmgPath = join(outputDir, `${appName}-${version}.dmg`)

// NOT `appName`. That named the volume after the app and put the app inside it,
// so the bundle staged at `/Volumes/<App>/<App>.app` - a path macOS refuses on
// any Mac where that app is installed and TCC-managed, failing the build at the
// last step with "Operation not permitted" (stacksjs/stacks#2884).
const volumeName = dmgVolumeName({ appName, version, override: process.env.DESKTOP_VOLUME_NAME })
if (volumeName === appName) {
  log.warn(`DESKTOP_VOLUME_NAME is the app's own name, so the bundle stages at /Volumes/${appName}/${appName}.app. That path is refused on a Mac where ${appName} is already installed; drop the variable to get "${appName} ${version}".`)
}

const created = await runCommand([
  'hdiutil', 'create',
  '-volname', volumeName,
  '-srcfolder', staging,
  '-ov', '-format', 'UDZO',
  dmgPath,
], { cwd: staging })

if (created.isErr)
  throw new Error(`hdiutil failed to create ${dmgPath}`)

rmSync(staging, { recursive: true, force: true })
rmSync(scratch, { recursive: true, force: true })

if (signingIdentity) {
  // The image is signed too: Gatekeeper checks the DMG a person opens before
  // it ever looks at the app inside.
  await runBuildStep(['codesign', '--force', '--timestamp', '--sign', signingIdentity, dmgPath], {
    cwd: outputDir,
    describe: 'Signing the DMG',
  })
}

if (notaryProfile) {
  await notarize(dmgPath, 'the DMG')
  log.success('Notarized and stapled')
}

log.success(`Built ${dmgPath}`)
if (!signingIdentity) {
  log.info('Unsigned build: Gatekeeper blocks the first launch. Right-click the app and choose Open, or set DESKTOP_SIGNING_IDENTITY and DESKTOP_NOTARY_PROFILE before distributing.')
}
else if (!notaryProfile) {
  log.info('Signed but not notarized: other Macs still warn on first open. Set DESKTOP_NOTARY_PROFILE to notarize.')
}
