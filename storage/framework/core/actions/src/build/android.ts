import type { AndroidMobileConfig, MobileConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { toCraftAndroidConfig, validateAndroidMobileConfig } from './android-config'
import { resolveMobilePath } from './ios-config'

process.exitCode = 1

interface CraftAndroidBuilder {
  init(options: {
    name: string
    packageName: string
    output: string
    config: Record<string, unknown>
  }): Promise<void>
  build(options: {
    htmlPath?: string
    devServer?: string
    output: string
    release?: boolean
    compile?: boolean
  }): Promise<void>
}

async function loadCraftAndroidBuilder(): Promise<CraftAndroidBuilder> {
  const explicit = process.env.CRAFT_ANDROID_SRC
  try {
    if (explicit) return await import(pathToFileURL(explicit).href) as CraftAndroidBuilder
    return await import('craft-native/android') as CraftAndroidBuilder
  }
  catch (error) {
    throw new Error(
      'Craft Android builder is unavailable. Install the current craft-native package or set CRAFT_ANDROID_SRC to packages/android/src/index.ts in a Craft checkout.',
      { cause: error },
    )
  }
}

const configPath = projectPath('config/mobile.ts')
if (!existsSync(configPath)) throw new Error('Missing config/mobile.ts. Add an android section before running `buddy build:android`.')
const configModule = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`) as { default: MobileConfig }
const config = configModule.default.android as AndroidMobileConfig | undefined
if (!config) throw new Error('config/mobile.ts must define an android section')
validateAndroidMobileConfig(config)

const output = resolveMobilePath(projectPath(), config.output) ?? storagePath('framework/mobile/android')
const webAssets = resolveMobilePath(projectPath(), config.webAssets)
const fallbackWebAssets = resolveMobilePath(projectPath(), config.fallbackWebAssets)
const craftConfig = toCraftAndroidConfig(config)
craftConfig.appIconPath = resolveMobilePath(projectPath(), config.appIcon)
const builder = await loadCraftAndroidBuilder()

await builder.init({ name: config.appName, packageName: config.packageName, output, config: craftConfig })
await builder.build({
  output,
  htmlPath: webAssets ?? fallbackWebAssets,
  devServer: craftConfig.devServerURL as string | undefined,
  release: process.env.NODE_ENV === 'production',
  compile: process.env.STACKS_ANDROID_SKIP_GRADLE !== '1',
})

const sourceRevision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() }).stdout.toString().trim()
const generatedConfig = JSON.parse(readFileSync(`${output}/craft.config.json`, 'utf8')) as Record<string, unknown>
writeFileSync(`${output}/stacks-mobile.json`, `${JSON.stringify({
  schemaVersion: '1.0.0',
  platform: 'android',
  sourceRevision,
  source: webAssets ? { kind: 'bundled', path: webAssets } : {
    kind: 'remote',
    url: craftConfig.devServerURL,
    fallback: fallbackWebAssets ? { kind: 'bundled', path: fallbackWebAssets } : undefined,
  },
  capabilities: config.capabilities ?? {},
  craft: generatedConfig,
}, null, 2)}\n`)

log.success(`Built the Craft Android project in ${output}`)
process.exitCode = 0
