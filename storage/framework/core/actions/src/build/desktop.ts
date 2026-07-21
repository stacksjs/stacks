import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { corePath, projectPath, storagePath } from '@stacksjs/path'
import { resolveCraftBinary } from '@stacksjs/desktop'

const outputDir = storagePath('framework/desktop-dist')
const launcherName = process.platform === 'win32' ? 'stacks-desktop.exe' : 'stacks-desktop'
const runtimeName = process.platform === 'win32' ? 'craft-runtime.exe' : 'craft-runtime'
const appUrl = process.env.DESKTOP_URL || process.env.APP_URL

if (!appUrl)
  throw new Error('Desktop builds require APP_URL or DESKTOP_URL so the native app knows which Stacks application to open')

const url = new URL(/^https?:\/\//.test(appUrl) ? appUrl : `https://${appUrl}`)
const craftBinary = resolveCraftBinary()
if (basename(craftBinary) === 'craft' && !existsSync(craftBinary))
  throw new Error('Build Craft first in ~/Code/Tools/craft, or set CRAFT_BIN to the native Craft binary')

if (existsSync(outputDir))
  rmSync(outputDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

await runCommand('bun run build', { cwd: corePath('desktop') })
await runCommand(`bun build --compile ${JSON.stringify(corePath('desktop/src/launcher.ts'))} --outfile ${JSON.stringify(join(outputDir, launcherName))}`, {
  cwd: projectPath(),
})

copyFileSync(craftBinary, join(outputDir, runtimeName))
if (process.platform !== 'win32') {
  chmodSync(join(outputDir, launcherName), 0o755)
  chmodSync(join(outputDir, runtimeName), 0o755)
}

writeFileSync(join(outputDir, 'desktop.json'), `${JSON.stringify({
  url: url.toString().replace(/\/$/, ''),
  title: process.env.APP_NAME || 'Stacks',
  width: 1400,
  height: 900,
  darkMode: false,
  systemTray: true,
  hideDockIcon: false,
}, null, 2)}\n`)

log.success(`Built Craft desktop application in ${outputDir}`)
