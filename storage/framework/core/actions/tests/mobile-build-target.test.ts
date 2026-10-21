import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// The action is the seam: assert what a builder sees and what an operator
// reads. Craft and the platform tools are external boundaries; this fixture
// writes their output without running Xcode, Gradle, or any remote service.
async function build(platform: 'ios' | 'android', options: Record<string, unknown>) {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'stacks-mobile-target-'))
  try {
    mkdirSync(join(root, 'config'), { recursive: true })
    symlinkSync(join(checkout, 'node_modules'), join(root, 'node_modules'), 'dir')
    writeFileSync(join(root, 'package.json'), '{"name":"mobile-target-fixture","type":"module"}')
    writeFileSync(join(root, 'bunfig.toml'), '# No application preloads in this isolated process.\n')
    const config = { appName: 'Target fixture', bundleId: 'org.example.target', packageName: 'org.example.target', ...options }
    writeFileSync(join(root, 'config/mobile.ts'), `export default ${JSON.stringify({ [platform]: config })}`)
    mkdirSync(join(root, 'dist'), { recursive: true })
    writeFileSync(join(root, 'dist/index.html'), '<h1>Bundled target fixture</h1>')
    if (options.renderer === 'native') {
      mkdirSync(join(root, 'resources/native'), { recursive: true })
      writeFileSync(join(root, 'resources/native/Home.stx'), '<View><Text>Native target fixture</Text></View>')
    }
    const builder = join(root, 'builder.ts')
    writeFileSync(builder, `import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
export async function init({ output, config }) {
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'craft.config.json'), JSON.stringify(config))
  writeFileSync(join(output, 'Info.plist'), '<plist><dict></dict></plist>')
}
export async function build(options) { writeFileSync(join(options.output, 'build-options.json'), JSON.stringify(options)) }
`)
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
      join(checkout, `storage/framework/core/actions/src/build/${platform}.ts`),
    ], {
      cwd: root,
      env: {
        PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test',
        CRAFT_IOS_SRC: builder, CRAFT_ANDROID_SRC: builder,
        STACKS_IOS_SKIP_XCODEGEN: '1', STACKS_ANDROID_SKIP_GRADLE: '1',
      },
      stdout: 'pipe', stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const output = join(root, `storage/framework/mobile/${platform}`)
    return {
      log: `${stdout}\n${stderr}`,
      config: await Bun.file(join(output, 'craft.config.json')).json(),
      options: await Bun.file(join(output, 'build-options.json')).json(),
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test.each(['ios', 'android'] as const)('%s build reports the normalized remote target it passes to Craft', async (platform) => {
  const result = await build(platform, { url: 'example.org/m' })
  expect(result.config.devServerURL).toBe('https://example.org/m')
  expect(result.options.devServer).toBe('https://example.org/m')
  expect(result.log).toContain('Web source: https://example.org/m')
})

test.each(['ios', 'android'] as const)('%s build identifies bundled content without inventing a remote target', async (platform) => {
  const result = await build(platform, { webAssets: 'dist' })
  expect(result.options.htmlPath).toEndWith('/dist')
  expect(result.options.devServer).toBeUndefined()
  expect(result.log).toContain(`Bundled web source: ${result.options.htmlPath}`)
  expect(result.log).not.toContain('Web source:')
  expect(result.log).not.toContain('API site:')
})

test.each(['ios', 'android'] as const)('%s build distinguishes remote content from its offline fallback', async (platform) => {
  const result = await build(platform, { url: 'https://example.org/m', fallbackWebAssets: 'dist' })
  expect(result.options.devServer).toBe('https://example.org/m')
  expect(result.options.htmlPath).toEndWith('/dist')
  expect(result.log).toContain('Web source: https://example.org/m')
  expect(result.log).toContain(`Offline web fallback: ${result.options.htmlPath}`)
  expect(result.log).not.toContain('Bundled web source:')
})

test.each(['ios', 'android'] as const)('%s build describes native screens and their API site separately', async (platform) => {
  const result = await build(platform, { renderer: 'native', url: 'https://example.org/m', nativeScreens: { '/m': 'Home' } })
  expect(result.options.nativeBundlePath).toEndWith('/native-screens.js')
  expect(result.options.devServer).toBeUndefined()
  expect(result.log).toContain(`Native screens: ${result.options.nativeBundlePath}`)
  expect(result.log).toContain('API site: https://example.org/m')
  expect(result.log).not.toContain('Web source:')
})

test.each(['ios', 'android'] as const)('%s target reporting never prints URL credentials, query values, or fragments', async (platform) => {
  const result = await build(platform, { url: 'https://fixture-user:fixture-password@example.org/m?token=fixture-token#fixture-fragment' })
  expect(result.log).toContain('Web source: https://example.org/m')
  for (const value of ['fixture-user', 'fixture-password', 'fixture-token', 'fixture-fragment'])
    expect(result.log).not.toContain(value)
  // Reporting must not alter the resolved builder input.
  expect(result.options.devServer).toBe('https://fixture-user:fixture-password@example.org/m?token=fixture-token#fixture-fragment')
})
