import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('default preloader', () => {
  it('stays inert while a package postinstall script is running', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'stacks-preloader-'))
    tempDirs.push(tempDir)

    const sourcePath = resolve(import.meta.dir, '../../../defaults/resources/plugins/preloader.ts')
    const isolatedPreloader = resolve(tempDir, 'preloader.ts')
    await Bun.write(isolatedPreloader, Bun.file(sourcePath))

    const child = Bun.spawn([process.execPath, isolatedPreloader], {
      cwd: tempDir,
      env: {
        ...process.env,
        npm_lifecycle_event: 'postinstall',
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const stderr = await new Response(child.stderr).text()
    expect(await child.exited).toBe(0)
    expect(stderr).toBe('')
  })

  it('loads without workspace packages being linked', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'stacks-preloader-'))
    tempDirs.push(tempDir)

    const defaultsRoot = resolve(import.meta.dir, '../../../defaults')
    const envRoot = resolve(import.meta.dir, '../../env/src')
    const isolatedRunner = resolve(tempDir, 'run.ts')
    const isolatedPreloader = resolve(tempDir, 'storage/framework/defaults/resources/plugins/preloader.ts')
    const isolatedEnvRoot = resolve(tempDir, 'storage/framework/core/env/src')
    const isolatedPathRoot = resolve(tempDir, 'storage/framework/core/path/src')

    await mkdir(resolve(isolatedPreloader, '..'), { recursive: true })
    await mkdir(isolatedEnvRoot, { recursive: true })
    await mkdir(isolatedPathRoot, { recursive: true })
    await Promise.all([
      'resources/functions',
      'app/Models',
      'app/Jobs',
      'app/Controllers',
      'storage/framework/defaults/app/Models',
      'storage/framework/defaults/app/Controllers',
    ].map(path => mkdir(resolve(tempDir, path), { recursive: true })))
    // Round 3. env/plugin.ts and path/index.ts both import fine on their own,
    // so the stall is inside the preloader. Instrument the COPY (never the
    // framework source) with a marker before every `await import(`, so the last
    // marker printed names the line that never returns. Only statement-leading
    // lines are touched, so this cannot break a continuation.
    const preloaderSource = await Bun.file(resolve(defaultsRoot, 'resources/plugins/preloader.ts')).text()
    const instrumented = preloaderSource.split('\n').map((line, index) => {
      if (!/^\s*(?:const|let|var|await)\s.*await import\(/.test(line))
        return line
      const indent = line.match(/^\s*/)?.[0] ?? ''
      const label = `L${index + 1}: ${line.trim().slice(0, 70).replace(/'/g, '')}`
      return `${indent}process.stderr.write('[preloader ${label}]\\n')\n${line}`
    }).join('\n')
    await Bun.write(isolatedPreloader, instrumented)
    await Promise.all(['plugin.ts', 'crypto.ts', 'parser.ts'].map(file =>
      Bun.write(resolve(isolatedEnvRoot, file), Bun.file(resolve(envRoot, file))),
    ))
    await Bun.write(
      resolve(isolatedPathRoot, 'index.ts'),
      Bun.file(resolve(import.meta.dir, '../../path/src/index.ts')),
    )
    // TEMPORARY DIAGNOSTIC (stacksjs/stacks#2279 follow-up). The child hangs on
    // Linux CI and exits 0 on macOS with every environment and bun version I
    // tried, so this instruments the child to say where it stalls. Revert once
    // the cause is known.
    await Bun.write(isolatedRunner, [
      `const t0 = Date.now()`,
      `const mark = (m) => process.stderr.write(\`[mark +\${Date.now() - t0}ms] \${m}\\n\`)`,
      `process.on('exit', c => mark('exit ' + c))`,
      `const bomb = setTimeout(() => {`,
      `  let res = 'unavailable'`,
      `  try { res = JSON.stringify(process.getActiveResourcesInfo()) } catch (e) { res = 'threw: ' + e.message }`,
      `  mark('STILL ALIVE at 3s, active resources: ' + res)`,
      `  process.exit(9)`,
      `}, 3000)`,
      `if (typeof bomb.unref === 'function') bomb.unref()`,
      // Round 2. Round 1 proved the preloader import never settles and that
      // getActiveResourcesInfo() is EMPTY, so nothing holds the loop: it is a
      // promise that never resolves, not a leaked handle. Import each piece of
      // the graph on its own first to find which one it is.
      `mark('env plugin: start')`,
      `await import('./storage/framework/core/env/src/plugin.ts')`,
      `mark('env plugin: ok')`,
      `mark('path: start')`,
      `await import('./storage/framework/core/path/src/index.ts')`,
      `mark('path: ok')`,
      `mark('preloader: start')`,
      `await import('./storage/framework/defaults/resources/plugins/preloader.ts')`,
      `mark('preloader: ok')`,
      ``,
    ].join('\n'))

    // A curated environment rather than the developer's. This test is about
    // whether the preloader resolves with nothing linked, and it asserts on
    // empty stdout/stderr, so inheriting the ambient environment made it
    // assert on whatever database the machine running it happened to have
    // configured: a local `DB_CONNECTION=postgres` is enough to put a
    // bun-query-builder dialect warning on stderr and fail a test that has
    // nothing to do with databases.
    const child = Bun.spawn([process.execPath, isolatedRunner], {
      cwd: tempDir,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? tempDir,
        // Passed through deliberately. Code in this graph gates on it, and a
        // child that believes it is interactive can sit on a prompt instead of
        // exiting, which reads as a hang rather than a failure.
        ...(process.env.CI ? { CI: process.env.CI } : {}),
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const [stderr, stdout] = await Promise.all([
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ])
    // TEMPORARY DIAGNOSTIC: surface the child's markers in the CI log.
    console.error(`[preloader diag] exit=${await child.exited}\n--- stderr ---\n${stderr}\n--- stdout ---\n${stdout}\n--- end ---`)
    expect(stderr).toBe('')
    expect(stdout).toBe('')
    expect(await child.exited).toBe(0)
  })
})
