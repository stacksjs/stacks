import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface DesktopManifest {
  url: string
  title: string
  width: number
  height: number
  darkMode?: boolean
  systemTray?: boolean
  hideDockIcon?: boolean
}

const bundleDir = dirname(process.execPath)
const manifestPath = join(bundleDir, 'desktop.json')
const craftPath = join(bundleDir, process.platform === 'win32' ? 'craft-runtime.exe' : 'craft-runtime')

if (!existsSync(manifestPath))
  throw new Error(`Desktop manifest not found: ${manifestPath}`)
if (!existsSync(craftPath))
  throw new Error(`Craft runtime not found: ${craftPath}`)

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as DesktopManifest
const command = [
  craftPath,
  manifest.url,
  '--title',
  manifest.title,
  '--width',
  String(manifest.width),
  '--height',
  String(manifest.height),
  '--no-devtools',
]
if (manifest.darkMode) command.push('--dark')
if (manifest.systemTray) command.push('--system-tray')
if (manifest.hideDockIcon) command.push('--hide-dock-icon')

const child = Bun.spawn(command, {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
process.exit(await child.exited)
