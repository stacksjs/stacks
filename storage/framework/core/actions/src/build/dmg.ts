import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { appPath, projectPath, publicPath, resourcesPath, storagePath } from '@stacksjs/path'

/**
 * Package the `build:desktop` output as a macOS `.app` inside a `.dmg`.
 *
 * `build:desktop` emits a launcher, the Craft runtime, and a manifest — the
 * pieces, not something a person can double-click. This wraps them in a real
 * bundle and a mountable disk image.
 *
 * The result is UNSIGNED unless a Developer ID identity is supplied, so
 * Gatekeeper will refuse it on first open (right-click → Open, once). Set
 * `DESKTOP_SIGNING_IDENTITY` to sign, and notarize separately for distribution.
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

const outputDir = storagePath('framework/desktop-dmg')
if (existsSync(outputDir)) rmSync(outputDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

// Build the bundle in a staging dir; hdiutil images the whole directory, so
// only the .app may live there.
const staging = mkdtempSync(join(tmpdir(), 'stacks-dmg-'))
// Scratch space kept OUT of the staged folder: hdiutil images that directory
// wholesale, so anything left there ships inside the DMG next to the app.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-dmg-work-'))
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
const launcherName = 'stacks-desktop'
const bundledFiles = readdirSync(desktopDist).filter(name => statSync(join(desktopDist, name)).isFile())
for (const file of bundledFiles)
  await runCommand(['cp', join(desktopDist, file), join(macosDir, file)], { cwd: projectPath() })

if (!existsSync(join(macosDir, launcherName)))
  throw new Error(`build:desktop did not produce ${launcherName}`)

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
  if (built.isErr || !existsSync(icns)) return undefined
  return 'AppIcon'
}

const iconFile = await buildIcon()

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
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
${ownsLauncher
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
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>`}${iconFile ? `
  <key>CFBundleIconFile</key><string>${iconFile}</string>` : ''}
</dict>
</plist>
`)

if (signingIdentity) {
  // Inside-out: every nested executable, then the launcher, then the bundle.
  // Signing the parent first invalidates its seal the moment an inner binary is
  // signed after it — and an app-owned launcher may ship several.
  const nested = bundledFiles
    .filter(name => name !== launcherName && !name.endsWith('.json') && !name.endsWith('.sha256'))
    .map(name => join(macosDir, name))

  for (const target of [...nested, join(macosDir, launcherName), appDir])
    await runCommand(['codesign', '--force', '--options', 'runtime', '--sign', signingIdentity, target], { cwd: staging })
}

// The drag-to-install target every macOS DMG is expected to have.
symlinkSync('/Applications', join(staging, 'Applications'))

const dmgPath = join(outputDir, `${appName}-${version}.dmg`)
const created = await runCommand([
  'hdiutil', 'create',
  '-volname', appName,
  '-srcfolder', staging,
  '-ov', '-format', 'UDZO',
  dmgPath,
], { cwd: staging })

if (created.isErr)
  throw new Error(`hdiutil failed to create ${dmgPath}`)

rmSync(staging, { recursive: true, force: true })
rmSync(scratch, { recursive: true, force: true })

log.success(`Built ${dmgPath}`)
if (!signingIdentity) {
  log.info('Unsigned build: Gatekeeper blocks the first launch. Right-click the app and choose Open, or set DESKTOP_SIGNING_IDENTITY and notarize before distributing.')
}
