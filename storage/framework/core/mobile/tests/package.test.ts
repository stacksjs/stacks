import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

test('the built mobile package has usable declarations and bundles for browsers', async () => {
  const source = join(import.meta.dir, '..')
  const runtime = join(source, '../../runtime')
  await mkdir(runtime, { recursive: true })
  const directory = await mkdtemp(join(runtime, 'mobile-package-'))
  try {
    const workspace = join(directory, 'workspace')
    const pkg = join(workspace, 'mobile')
    await mkdir(pkg, { recursive: true })
    await symlink(join(source, '../build'), join(workspace, 'build'), 'dir')
    await cp(join(source, 'src'), join(pkg, 'src'), { recursive: true })
    await cp(join(source, 'build.ts'), join(pkg, 'build.ts'))
    await cp(join(source, 'package.json'), join(pkg, 'package.json'))
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler',
        strict: true, noEmit: true, types: [], lib: ['ESNext', 'DOM'],
      },
      files: ['consumer.ts'],
    }))

    async function run(cmd: string[], cwd: string) {
      const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, APP_ENV: 'test' } })
      const watchdog = setTimeout(() => proc.kill(), 15_000)
      try {
        const [code, out, error] = await Promise.all([
          proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text(),
        ])
        expect(code, out + error).toBe(0)
      }
      finally {
        clearTimeout(watchdog)
      }
    }
    await run([process.execPath, 'run', 'build.ts'], pkg)

    const installed = join(directory, 'node_modules/@stacksjs/mobile')
    await mkdir(installed, { recursive: true })
    await cp(join(pkg, 'package.json'), join(installed, 'package.json'))
    await cp(join(pkg, 'dist'), join(installed, 'dist'), { recursive: true })
    await cp(join(import.meta.dir, 'fixtures/consumer.ts'), join(directory, 'consumer.ts'))
    const compiler = join(dirname(Bun.resolveSync('typescript', import.meta.dir)), '../bin/tsc')
    await run([process.execPath, compiler, '--project', join(directory, 'tsconfig.json'), '--pretty', 'false'], directory)

    // Resolve the installed package, not workspace source aliases. Bundle Craft's
    // real browser entrypoint as a consumer would, then import without a window.
    await writeFile(join(directory, 'browser.ts'), "export { mobile, getNativeMobileBridge } from '@stacksjs/mobile'\n")
    const bundle = await Bun.build({
      entrypoints: [join(directory, 'browser.ts')], outdir: join(directory, 'browser'),
      target: 'browser', format: 'esm', tsconfig: join(directory, 'tsconfig.json'),
    })
    expect(bundle.success, JSON.stringify(bundle.logs)).toBe(true)
    const output = bundle.outputs[0]!
    expect(new Bun.Transpiler({ loader: 'js' }).scanImports(await output.text())).toEqual([])
    const loaded = await import(pathToFileURL(output.path).href)
    expect(loaded.mobile.nativeBridge).toBeNull()
    expect(loaded.getNativeMobileBridge()).toBeNull()
    expect(typeof loaded.mobile.location.startRecording).toBe('function')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 40_000)
