import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scripts } from '../package.json'

test('native compile settings load normal project package preloads', async () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-native-package-preload-'))
  try {
    const dependency = join(root, 'node_modules', 'fixture-preload')
    mkdirSync(dependency, { recursive: true })
    writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-preload', exports: { './plugin.js': './plugin.js' } }))
    writeFileSync(join(dependency, 'plugin.js'), 'process.env.BUDDY_FIXTURE_PRELOAD = "loaded"')
    writeFileSync(join(root, 'bunfig.toml'), 'preload = ["fixture-preload/plugin.js"]')
    const entry = join(root, 'entry.ts')
    writeFileSync(entry, 'if (process.env.BUDDY_FIXTURE_PRELOAD !== "loaded") throw new Error("Project preload missing"); console.log("NATIVE_PRELOAD_OK")')
    const settings = scripts.compile.split(' ').filter(argument => argument.startsWith('--compile-'))
    expect(settings).toContain('--compile-autoload-package-json')
    const binary = join(root, process.platform === 'win32' ? 'probe.exe' : 'probe')
    const build = Bun.spawn([process.execPath, 'build', entry, '--compile', ...settings, '--outfile', binary], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [built, , buildError] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
    expect(built, buildError).toBe(0)
    const child = Bun.spawn([binary], { cwd: root, env: { ...process.env, BUDDY_FIXTURE_PRELOAD: '' }, stdout: 'pipe', stderr: 'pipe' })
    const [status, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(status, stderr).toBe(0)
    expect(stdout).toContain('NATIVE_PRELOAD_OK')
    for (const [name, command] of Object.entries(scripts)) {
      if (name === 'compile' || name.startsWith('compile:') && name !== 'compile:all')
        expect(command).toContain('--compile-autoload-package-json')
    }
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 30_000)
