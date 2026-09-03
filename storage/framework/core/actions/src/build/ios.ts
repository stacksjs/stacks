import type { MobileConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { resolveCraftBuilderProvenance } from './craft-provenance'
import { resolveMobilePath, toCraftIosConfig, validateIosMobileConfig } from './ios-config'

// Action runners install a global exception reporter. Start pessimistically so
// a reported exception can never look like a successful CI build.
process.exitCode = 1

interface CraftIosBuilder {
  init(options: {
    name: string
    bundleId: string
    teamId?: string
    output: string
    config: Record<string, unknown>
  }): Promise<void>
  build(options: {
    htmlPath?: string
    devServer?: string
    output: string
    generateProject?: boolean
  }): Promise<void>
}

async function loadCraftIosBuilder(): Promise<CraftIosBuilder> {
  const explicit = process.env.CRAFT_IOS_SRC
  try {
    if (explicit) return await import(pathToFileURL(explicit).href) as CraftIosBuilder
    const moduleName = 'craft-native/ios'
    return await import(moduleName) as CraftIosBuilder
  }
  catch (error) {
    throw new Error(
      'Craft iOS builder is unavailable. Install the current craft-native package or set CRAFT_IOS_SRC to packages/ios/src/index.ts in a Craft checkout.',
      { cause: error },
    )
  }
}

const configPath = projectPath('config/mobile.ts')
if (!existsSync(configPath)) {
  throw new Error('Missing config/mobile.ts. Add an ios section before running `buddy build:ios`.')
}

const configModule = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`) as { default: MobileConfig }
const config = configModule.default.ios
validateIosMobileConfig(config)

const output = resolveMobilePath(projectPath(), config.output) ?? storagePath('framework/mobile/ios')
const webAssets = resolveMobilePath(projectPath(), config.webAssets)
const fallbackWebAssets = resolveMobilePath(projectPath(), config.fallbackWebAssets)
const craftConfig = toCraftIosConfig(config)
craftConfig.appIconPath = resolveMobilePath(projectPath(), config.appIcon)
const builder = await loadCraftIosBuilder()

await builder.init({
  name: config.appName,
  bundleId: config.bundleId,
  teamId: config.teamId,
  output,
  config: craftConfig,
})

await builder.build({
  output,
  htmlPath: webAssets ?? fallbackWebAssets,
  devServer: craftConfig.devServerURL as string | undefined,
  generateProject: process.env.STACKS_IOS_SKIP_XCODEGEN !== '1',
})

const sourceRevision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() }).stdout.toString().trim()
const craftConfigPath = `${output}/craft.config.json`
const generatedConfig = JSON.parse(readFileSync(craftConfigPath, 'utf8')) as Record<string, unknown>
writeFileSync(`${output}/stacks-mobile.json`, `${JSON.stringify({
  schemaVersion: '1.0.0',
  platform: 'ios',
  sourceRevision,
  source: webAssets ? { kind: 'bundled', path: webAssets } : {
    kind: 'remote',
    url: craftConfig.devServerURL,
    fallback: fallbackWebAssets ? { kind: 'bundled', path: fallbackWebAssets } : undefined,
  },
  capabilities: config.capabilities ?? {},
  builder: resolveCraftBuilderProvenance(process.env.CRAFT_IOS_SRC),
  craft: generatedConfig,
}, null, 2)}\n`)

log.success(`Built the Craft iOS project in ${output}`)
await log.flush()
process.exitCode = 0
