import { expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'

// Opt in with explicit disposable devices. This never selects, resets or deletes
// an existing device, and it installs only the fixture's distinct bundle id.
const root = resolve(import.meta.dir, '../../../../..')
const output = resolve(process.env.STACKS_STORY_NATIVE_OUTPUT ?? join(root, 'storage/logs/stories-native'))
const cli = resolve(import.meta.dir, '../../buddy/src/cli.ts')
const driver = pathToFileURL(resolve(import.meta.dir, '../src/story-drivers.ts')).href
const fixture = resolve(import.meta.dir, 'fixtures')
async function exec(args: string[], cwd = root): Promise<string> {
  const child = spawnOwnedProcess(args, { cwd })
  const timeout = setTimeout(() => { void child.stop() }, 240000)
  try {
    const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (exit.code !== 0) throw new Error(`${args[0]} failed (${exit.code}): ${stderr.slice(-4000)}`)
    return stdout
  }
  finally { clearTimeout(timeout); await child.stop() }
}
async function record(config: string) {
  const report = JSON.parse(await exec([process.execPath, '--conditions=development', cli, 'docs:stories', '--config', config, '--json']))
  expect(report.results[0].status).toBe('passed')
  expect(report.results[0].scenes.map((scene: { status: string }) => scene.status)).toEqual(['passed', 'passed'])
  const movie = join(report.mediaDir ?? report.outDir, report.results[0].video.path)
  // Recorded without FFmpeg: read the container back with ts-videos.
  const { Mp4Demuxer } = await import('@ts-videos/mp4')
  const { BufferSource } = await import('ts-videos')
  const picture = (await new Mp4Demuxer(new BufferSource(new Uint8Array(await readFile(movie)))).getTracks()).find(track => track.type === 'video') as { codec: string, width: number } | undefined
  expect(picture?.codec).toBe('h264')
  expect(picture!.width).toBeGreaterThan(200)
  await exec([process.execPath, '--conditions=development', cli, 'docs:stories', '--config', config, '--check'])
  const page = await readFile(join(report.outDir, report.results[0].page.path), 'utf8')
  expect(page.match(/!\[/g)?.length).toBe(2)
}

test.skipIf(!process.env.STACKS_STORY_IOS_DEVICE)('records actual iOS input, two native scenes and generated docs through Buddy', async () => {
  const device = process.env.STACKS_STORY_IOS_DEVICE!
  const directory = join(output, 'ios')
  const app = join(directory, 'StoryFixture.app')
  await mkdir(app, { recursive: true })
  const sdk = (await exec(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'])).trim()
  await exec(['xcrun', '--sdk', 'iphonesimulator', 'swiftc', '-parse-as-library', '-sdk', sdk, '-target', 'arm64-apple-ios17.0-simulator', join(fixture, 'story-ios.swift'), '-o', join(app, 'StoryFixture')])
  await writeFile(join(app, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>StoryFixture</string><key>CFBundleIdentifier</key><string>dev.stacks.storyfixture</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleName</key><string>Story Fixture</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>LSRequiresIPhoneOS</key><true/><key>UILaunchScreen</key><dict/><key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><false/><key>UISceneConfigurations</key><dict/></dict><key>UIDeviceFamily</key><array><integer>1</integer></array></dict></plist>`)
  await exec(['codesign', '--force', '--sign', '-', app])
  await exec(['xcrun', 'simctl', 'install', device, app])
  let ready!: () => void
  let releaseTap!: () => void
  let tapped!: () => void
  let releaseDone!: () => void
  const isReady = new Promise<void>(resolve => { ready = resolve })
  const shouldTap = new Promise<void>(resolve => { releaseTap = resolve })
  const didTap = new Promise<void>(resolve => { tapped = resolve })
  const done = new Promise<void>(resolve => { releaseDone = resolve })
  const script = 'launch\nexpect Review cart\nexec ready\ntapxy 0.5 0.5\nexpect Order confirmed\nexec tapped\n'
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, idleTimeout: 255, async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/script') return new Response(script)
    if (url.pathname === '/note') return new Response('ok')
    if (url.pathname === '/exec' && url.searchParams.get('name') === 'ready') { ready(); await shouldTap; return new Response('ok') }
    if (url.pathname === '/exec' && url.searchParams.get('name') === 'tapped') { tapped(); await done; return new Response('ok') }
    if (url.pathname === '/tap') { releaseTap(); await didTap; return new Response('ok') }
    return new Response('Not found', { status: 404 })
  } })
  const { initSimulatorDriver } = await import('craft-native/ios')
  const project = join(directory, 'driver')
  initSimulatorDriver({ output: project, bundleId: 'dev.stacks.storyfixture', projectName: 'StoryDriver', controlUrl: server.url.href.replace(/\/$/, ''), deploymentTarget: '17.0' })
  const derived = join(directory, 'derived')
  await exec(['xcodegen', 'generate', '--spec', join(project, 'project.yml')], project)
  const xcode = ['xcodebuild', '-project', join(project, 'StoryDriver.xcodeproj'), '-scheme', 'StoryDriver', '-destination', `platform=iOS Simulator,id=${device}`, '-derivedDataPath', derived, '-jobs', '2', '-parallel-testing-enabled', 'NO', 'CODE_SIGNING_ALLOWED=NO']
  await exec([...xcode, 'build-for-testing'])
  const testing = spawnOwnedProcess([...xcode, 'test-without-building'])
  const stdout = new Response(testing.stdout).text()
  const stderr = new Response(testing.stderr).text()
  const deadline = setTimeout(() => { void testing.stop() }, 180000)
  try {
    await Promise.race([isReady, testing.exited.then(async () => { throw new Error(`XCTest exited before ready: ${(await stdout).slice(-6000)} ${(await stderr).slice(-3000)}`) })])
    const screenshot = join(directory, 'dimensions.png')
    await exec(['xcrun', 'simctl', 'io', device, 'screenshot', screenshot])
    const png = await readFile(screenshot)
    expect(png.subarray(12, 16).toString()).toBe('IHDR')
    const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
    const config = join(directory, 'stories.ts')
    await writeFile(config, `import { nativeStory } from ${JSON.stringify(driver)}
      export default {outDir:${JSON.stringify(join(directory, 'docs'))}, holdMs:500,stories:[{id:'native-ios',title:'Native iOS purchase',driver:nativeStory({platform:'ios',device:${JSON.stringify(device)},input:{async tap(x,y){if(x!==${dimensions.width / 2}||y!==${dimensions.height / 2})throw new Error('Unexpected fixture target');const response=await fetch(${JSON.stringify(`${server.url}tap`)});if(!response.ok)throw new Error('Native tap failed')}}}),scenes:[
        {id:'cart',title:'Review cart',run:async()=>{}},
        {id:'purchased',title:'Order confirmed',run:async view=>{await view.tap(${dimensions.width / 2},${dimensions.height / 2})}}
      ]}]}`)
    await record(config)
    releaseDone()
    expect((await testing.exited).code).toBe(0)
  }
  finally {
    releaseTap(); releaseDone(); clearTimeout(deadline); await testing.stop()
    await writeFile(join(directory, 'xctest.stdout.log'), await stdout)
    await writeFile(join(directory, 'xctest.stderr.log'), await stderr)
    server.stop(true)
  }
}, 360000)

test.skipIf(!process.env.STACKS_STORY_ANDROID_DEVICE)('records actual Android input, two native scenes and generated docs through Buddy', async () => {
  const device = process.env.STACKS_STORY_ANDROID_DEVICE!
  const directory = join(output, 'android')
  await mkdir(join(directory, 'classes'), { recursive: true })
  const sdk = process.env.ANDROID_HOME!
  if (!sdk) throw new Error('ANDROID_HOME is required')
  const tools = join(sdk, 'build-tools', process.env.STACKS_STORY_ANDROID_BUILD_TOOLS ?? '35.0.0')
  const jar = join(sdk, 'platforms', 'android-35', 'android.jar')
  const adb = join(sdk, 'platform-tools', 'adb')
  const manifest = join(directory, 'AndroidManifest.xml')
  await writeFile(manifest, '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="dev.stacks.storyfixture"><uses-sdk android:minSdkVersion="26" android:targetSdkVersion="34"/><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:label="Story Fixture"><activity android:name=".StoryActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>')
  await exec(['javac', '-source', '8', '-target', '8', '-classpath', jar, '-d', join(directory, 'classes'), join(fixture, 'StoryActivity.java')])
  await exec([join(tools, 'd8'), '--lib', jar, '--output', directory, join(directory, 'classes/dev/stacks/storyfixture/StoryActivity.class')])
  await exec([join(tools, 'aapt'), 'package', '-f', '-M', manifest, '-I', jar, '-F', join(directory, 'unsigned.apk')])
  await exec([join(tools, 'aapt'), 'add', join(directory, 'unsigned.apk'), 'classes.dex'], directory)
  const key = join(directory, 'fixture.keystore')
  if (!await Bun.file(key).exists()) await exec(['keytool', '-genkeypair', '-keystore', key, '-storepass', 'fixture-only', '-keypass', 'fixture-only', '-alias', 'fixture', '-dname', 'CN=Stacks Story Test', '-keyalg', 'RSA', '-validity', '30'])
  const apk = join(directory, 'fixture.apk')
  await exec([join(tools, 'apksigner'), 'sign', '--ks', key, '--ks-pass', 'pass:fixture-only', '--out', apk, join(directory, 'unsigned.apk')])
  await exec([adb, '-s', device, 'install', '-r', apk])
  await exec([adb, '-s', device, 'shell', 'am', 'start', '-W', '-n', 'dev.stacks.storyfixture/.StoryActivity'])
  await exec([adb, '-s', device, 'shell', 'uiautomator', 'dump', '/sdcard/stacks-story-fixture.xml'])
  const tree = await exec([adb, '-s', device, 'exec-out', 'cat', '/sdcard/stacks-story-fixture.xml'])
  const bounds = /text="Buy"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tree)
  if (!bounds) throw new Error('Native fixture button not found')
  const x = (Number(bounds[1]) + Number(bounds[3])) / 2
  const y = (Number(bounds[2]) + Number(bounds[4])) / 2
  const config = join(directory, 'stories.ts')
  await writeFile(config, `import { nativeStory } from ${JSON.stringify(driver)}
    export default {outDir:${JSON.stringify(join(directory, 'docs'))},holdMs:500,stories:[{id:'native-android',title:'Native Android purchase',driver:nativeStory({platform:'android',device:${JSON.stringify(device)},adb:${JSON.stringify(adb)}}),scenes:[
      {id:'cart',title:'Review cart',run:async()=>{}},
      {id:'purchased',title:'Order confirmed',run:async view=>{await view.tap(${x},${y})}}
    ]}]}`)
  await record(config)
  await exec([adb, '-s', device, 'shell', 'uiautomator', 'dump', '/sdcard/stacks-story-fixture.xml'])
  expect(await exec([adb, '-s', device, 'exec-out', 'cat', '/sdcard/stacks-story-fixture.xml'])).toContain('Order confirmed')
  await exec([adb, '-s', device, 'shell', 'rm', '/sdcard/stacks-story-fixture.xml'])
}, 180000)
