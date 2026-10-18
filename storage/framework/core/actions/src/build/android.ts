import type { AndroidMobileConfig, MobileConfig } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { craftBuilderSpecifier, craftBuilderVersion } from './craft-entry'
import { resolveCraftBuilderProvenance } from './craft-provenance'
import { androidRelease, assertCraftSupportsAndroid, assertCraftSupportsAndroidMapProvider, toCraftAndroidConfig, uploadAndroidMapping, validateAndroidMobileConfig } from './android-config'
import { resolveCrashReporting, resolveMobilePath, resolveNativeFonts, assertCraftSupportsNativeFonts } from './ios-config'
import { compileNativeScreens } from './native-screens'
import { writeAndroidIconTable } from './android-icons'

process.exitCode = 1

interface CraftAndroidBuilder {
  nativeMapProviders?: readonly string[]
  init(options: {
    name: string
    packageName: string
    output: string
    config: Record<string, unknown>
  }): Promise<void>
  build(options: {
    htmlPath?: string
    devServer?: string
    nativeBundlePath?: string
    iconsPath?: string
    output: string
    release?: boolean
    bundle?: boolean
    compile?: boolean
  }): Promise<void>
}

function craftAndroidEntry(): string {
  const explicit = process.env.CRAFT_ANDROID_SRC
  return explicit ? pathToFileURL(explicit).href : craftBuilderSpecifier('android', projectPath())
}

async function loadCraftAndroidBuilder(): Promise<CraftAndroidBuilder> {
  try {
    return await import(craftAndroidEntry()) as CraftAndroidBuilder
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
const androidSection = configModule.default.android as AndroidMobileConfig | undefined
if (!androidSection) throw new Error('config/mobile.ts must define an android section')
// The shared `crashReporting` under Android's own.
const config: AndroidMobileConfig = { ...androidSection, crashReporting: resolveCrashReporting(configModule.default.crashReporting, androidSection.crashReporting) }
validateAndroidMobileConfig(config)

const output = resolveMobilePath(projectPath(), config.output) ?? storagePath('framework/mobile/android')
const webAssets = resolveMobilePath(projectPath(), config.webAssets)
const fallbackWebAssets = resolveMobilePath(projectPath(), config.fallbackWebAssets)
const craftConfig = toCraftAndroidConfig(config)
craftConfig.nativeFonts = resolveNativeFonts(config.nativeFonts, projectPath())
craftConfig.appIconPath = resolveMobilePath(projectPath(), config.appIcon)
craftConfig.notificationIconPath = resolveMobilePath(projectPath(), config.notificationIcon)
craftConfig.googleServicesFile = resolveMobilePath(projectPath(), config.googleServicesFile)
if (process.env.NODE_ENV === 'production' && config.capabilities?.pushNotifications && !craftConfig.googleServicesFile) {
  throw new Error('Production Android push notifications require android.googleServicesFile in config/mobile.ts')
}

// `buddy build:android --bundle` (STACKS_ANDROID_BUNDLE=1): an Android App
// Bundle for Google Play, always a release build.
const appBundle = process.env.STACKS_ANDROID_BUNDLE === '1'
const release = appBundle || process.env.NODE_ENV === 'production'

// Screens drawn natively, compiled by stx into the bundle Craft copies in:
// the same screens and app script as the iOS app.
const native = config.renderer === 'native'
const nativeBundle = native ? await compileNativeScreens(config, projectPath(), output, undefined, 'android') : null
if (nativeBundle) {
  for (const diagnostic of nativeBundle.diagnostics ?? [])
    log.warn(`${diagnostic.file ? `${diagnostic.file}: ` : ''}${diagnostic.message}`)
  log.info(`Compiled ${Object.keys(config.nativeScreens ?? {}).length} native screen path(s) into ${nativeBundle.outFile}`)
}

// Android has no SF Symbols: the screens' icons go in as the vectors the web
// draws (the app's Lucide), by Iconify name and by the symbol stx maps them to.
const { LUCIDE_TO_SF } = native ? await import('@stacksjs/stx/native') as { LUCIDE_TO_SF: Record<string, string> } : { LUCIDE_TO_SF: {} }
const iconsPath = native ? writeAndroidIconTable(projectPath(), output, LUCIDE_TO_SF) : null
if (native && !iconsPath)
  log.warn('No @iconify-json/lucide in the app: Android draws its own glyphs for the screens\' icons.')

const builder = await loadCraftAndroidBuilder()

// An older Craft builds without the shell, Health Connect or background
// refresh and says nothing, so the build stops here instead.
const craftVersion = craftBuilderVersion(craftAndroidEntry(), projectPath())
assertCraftSupportsNativeFonts(config.nativeFonts, craftVersion?.version)
if (craftVersion)
  assertCraftSupportsAndroid(config, craftVersion.version, craftVersion.manifest, { appBundle })
else
  log.warn(`Could not read the craft-native version behind ${craftAndroidEntry()}, so the build cannot check that it supports what config/mobile.ts asks for.`)

assertCraftSupportsAndroidMapProvider(config, builder.nativeMapProviders)
await builder.init({ name: config.appName, packageName: config.packageName, output, config: craftConfig })
await builder.build(native
  ? { output, nativeBundlePath: nativeBundle!.outFile, iconsPath: iconsPath ?? undefined, release, bundle: appBundle, compile: process.env.STACKS_ANDROID_SKIP_GRADLE !== '1' }
  : {
      output,
      htmlPath: webAssets ?? fallbackWebAssets,
      devServer: craftConfig.devServerURL as string | undefined,
      release,
      bundle: appBundle,
      compile: process.env.STACKS_ANDROID_SKIP_GRADLE !== '1',
    })

// A minified release build's frames are renamed by R8: hand bughq the
// mapping, keyed by the release the app's events name.
if (release && config.crashReporting?.key && config.crashReporting.uploadSymbols !== false && process.env.STACKS_ANDROID_SKIP_GRADLE !== '1') {
  const upload = await uploadAndroidMapping(
    `${output}/app/build/outputs/mapping/release/mapping.txt`,
    config.crashReporting.host ?? 'https://bughq.org',
    androidRelease(config),
    process.env.BUGHQ_UPLOAD_TOKEN,
  )
  if (upload.ok) log.info(upload.message)
  else log.warn(upload.message)
}

const sourceRevision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() }).stdout.toString().trim()
const generatedConfig = JSON.parse(readFileSync(`${output}/craft.config.json`, 'utf8')) as Record<string, unknown>
writeFileSync(`${output}/stacks-mobile.json`, `${JSON.stringify({
  schemaVersion: '1.0.0',
  platform: 'android',
  sourceRevision,
  source: native ? { kind: 'native', site: craftConfig.devServerURL } : webAssets ? { kind: 'bundled', path: webAssets } : {
    kind: 'remote',
    url: craftConfig.devServerURL,
    fallback: fallbackWebAssets ? { kind: 'bundled', path: fallbackWebAssets } : undefined,
  },
  capabilities: config.capabilities ?? {},
  builder: resolveCraftBuilderProvenance(process.env.CRAFT_ANDROID_SRC),
  craft: generatedConfig,
}, null, 2)}\n`)

log.success(`Built the Craft Android project in ${output}`)
await log.flush()
process.exitCode = 0
