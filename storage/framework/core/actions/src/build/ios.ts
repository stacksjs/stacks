import type { MobileConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { craftBuilderSpecifier, craftBuilderVersion } from './craft-entry'
import { resolveCraftBuilderProvenance } from './craft-provenance'
import { assertCraftSupportsCapabilities, portablePaths, resolveMobilePath, toCraftIosConfig, validateIosMobileConfig, writeIosActivityTypes } from './ios-config'
import { compileNativeScreens } from './native-screens'
import { writeIosShellSupport } from './ios-shell'

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
    nativeBundlePath?: string
    output: string
    generateProject?: boolean
  }): Promise<void>
}

/** The Craft iOS builder entry: `CRAFT_IOS_SRC`, else the copy @stacksjs/mobile resolves. */
function craftIosEntry(): string {
  const explicit = process.env.CRAFT_IOS_SRC
  return explicit ? pathToFileURL(explicit).href : craftBuilderSpecifier('ios', projectPath())
}

async function loadCraftIosBuilder(): Promise<CraftIosBuilder> {
  try {
    return await import(craftIosEntry()) as CraftIosBuilder
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
const mobile = configModule.default
const config = mobile.ios
validateIosMobileConfig(config)
// The stx router swipes back itself; WebKit's gesture on as well fights it.
if (config.swipeNavigation === true && config.swipeBack !== 'webview')
  log.warn('ios.swipeNavigation turns on WebKit\'s edge swipe alongside the stx router\'s own. Remove it, or set ios.swipeBack: \'webview\' for an app not on the router.')

const output = resolveMobilePath(projectPath(), config.output) ?? storagePath('framework/mobile/ios')
const webAssets = resolveMobilePath(projectPath(), config.webAssets)
const fallbackWebAssets = resolveMobilePath(projectPath(), config.fallbackWebAssets)
const craftConfig = toCraftIosConfig(config)
craftConfig.appIconPath = resolveMobilePath(projectPath(), config.appIcon)
craftConfig.splashImagePath = resolveMobilePath(projectPath(), config.splash?.image)
craftConfig.splashImagePathDark = resolveMobilePath(projectPath(), config.splash?.imageDark)

// Screens drawn natively, compiled by stx before Craft copies them in.
const nativeBundle = await compileNativeScreens(config, projectPath(), output)
if (nativeBundle) {
  craftConfig.nativeBundle = nativeBundle.outFile
  for (const diagnostic of nativeBundle.diagnostics ?? [])
    log.warn(`${diagnostic.file ? `${diagnostic.file}: ` : ''}${diagnostic.message}`)
  log.info(`Compiled ${Object.keys(config.nativeScreens ?? {}).length} native screen path(s) into ${nativeBundle.outFile}`)
}

const builder = await loadCraftIosBuilder()

// An older Craft drops a capability it has no template for without a word,
// so the build fails here rather than ship an app that lacks it.
const craftVersion = craftBuilderVersion(craftIosEntry(), projectPath())
if (craftVersion)
  assertCraftSupportsCapabilities(config.capabilities, craftVersion.version, craftVersion.manifest)
else
  log.warn(`Could not read the craft-native version behind ${craftIosEntry()}, so the build cannot check that it supports every capability config/mobile.ts turns on.`)

await builder.init({
  name: config.appName,
  bundleId: config.bundleId,
  teamId: config.teamId,
  output,
  config: craftConfig,
})

// A native-renderer app has no web view to point at a page or a dev server:
// its screens are the bundle, and `url` is only its site (craft.config.json's
// devServerURL), which Craft reads for the start path and the API.
const native = config.renderer === 'native'
if (native && !nativeBundle) throw new Error('ios.renderer \'native\' needs native screens to draw: list them in ios.nativeScreens')
await builder.build(native
  ? { output, nativeBundlePath: nativeBundle!.outFile, generateProject: process.env.STACKS_IOS_SKIP_XCODEGEN !== '1' }
  : {
      output,
      htmlPath: webAssets ?? fallbackWebAssets,
      devServer: craftConfig.devServerURL as string | undefined,
      generateProject: process.env.STACKS_IOS_SKIP_XCODEGEN !== '1',
    })

writeIosShellSupport(output, config)

// Declared after the builder, which rewrites Info.plist from its template on
// every build, and safe before or after xcodegen, which only references it.
const activityTypes = writeIosActivityTypes(output, mobile)
if (activityTypes)
  log.info(`Declared ${activityTypes.length} activity types, so a tapped Spotlight or Siri entry reaches the app`)

const sourceRevision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() }).stdout.toString().trim()
const craftConfigPath = `${output}/craft.config.json`
const generatedConfig = portablePaths(JSON.parse(readFileSync(craftConfigPath, 'utf8')) as Record<string, unknown>, output, projectPath())
writeFileSync(craftConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`)
writeFileSync(`${output}/stacks-mobile.json`, `${JSON.stringify(portablePaths({
  schemaVersion: '1.0.0',
  platform: 'ios',
  sourceRevision,
  source: native ? { kind: 'native', site: craftConfig.devServerURL } : webAssets ? { kind: 'bundled', path: webAssets } : {
    kind: 'remote',
    url: craftConfig.devServerURL,
    fallback: fallbackWebAssets ? { kind: 'bundled', path: fallbackWebAssets } : undefined,
  },
  capabilities: config.capabilities ?? {},
  builder: resolveCraftBuilderProvenance(process.env.CRAFT_IOS_SRC),
  craft: generatedConfig,
}, output, projectPath()), null, 2)}\n`)

log.success(`Built the Craft iOS project in ${output}`)
await log.flush()
process.exitCode = 0
