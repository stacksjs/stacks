import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '@stacksjs/testing/isolated'

// stacksjs/stacks#3109: the generated setup shell used the fixed global path
// /tmp/mypipe for every run. Two runs shared one FIFO (each could read the
// other's stream, or delete it from under the other), and a failed or
// interrupted run left it behind for the next one to trip over.
//
// These run the shell the action really generates, in an owned directory with a
// stand-in `bun`, and never touch /tmp/mypipe: where a test must observe the
// FIFO boundary it intercepts `mkfifo` before anything is created.

const tools = ['dirname', 'mkfifo', 'tee', 'date', 'mktemp', 'rm', 'sleep', 'cat']

async function executable(file: string, source: string): Promise<void> {
  await writeFile(file, `#!/bin/sh\n${source}\n`, { mode: 0o755 })
}

async function which(tool: string): Promise<string> {
  for (const directory of ['/usr/bin', '/bin'])
    if (await Bun.file(join(directory, tool)).exists()) return join(directory, tool)
  throw new Error(`${tool} is not installed`)
}

async function generated(root: string): Promise<string> {
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ extends: resolve(import.meta.dir, '../../tsconfig.build.json') }))
  const actionUrl = pathToFileURL(resolve(import.meta.dir, '../../../defaults/app/Actions/InstallAction.ts')).href
  const output = join(root, 'install.sh')
  const generate = join(root, 'generate.ts')
  await writeFile(generate, `
    import action from ${JSON.stringify(actionUrl)}
    import { request } from '@stacksjs/router/request-context'
    const script = await action.handle(request)
    if (typeof script !== 'string') throw new Error('The development install action must return its shell script')
    await Bun.write(${JSON.stringify(output)}, script)
  `)
  const result = await runIsolated(generate, { cwd: root, inheritEnv: false, env: { APP_ENV: 'development', NODE_ENV: 'development' }, envFile: false, preload: [], timeoutMs: 10_000 })
  expect(result.code, result.stderr).toBe(0)
  return output
}

/** A project directory the generated script can run in, with a stand-in `bun`. */
async function project(scratch: string, name: string, setup: string): Promise<{ root: string, script: string, env: Record<string, string>, owned: string }> {
  const root = join(scratch, name)
  const owned = join(root, 'tmp')
  await mkdir(join(root, 'bin'), { recursive: true })
  await mkdir(owned)
  await mkdir(join(root, 'storage/logs'), { recursive: true })
  await mkdir(join(root, 'storage/framework/scripts'), { recursive: true })
  await mkdir(join(root, 'storage/framework/core/buddy/src'), { recursive: true })
  for (const tool of tools) await symlink(await which(tool), join(root, 'bin', tool))
  await executable(join(root, 'storage/framework/scripts/pantry-install'), 'exit 0')
  await executable(join(root, 'bin/bun'), setup)
  const script = await generated(root)
  return { root, script, owned, env: { PATH: join(root, 'bin'), HOME: join(root, 'home'), TMPDIR: owned } }
}

async function withScratch<T>(run: (scratch: string) => Promise<T>): Promise<T> {
  const scratch = await mkdtemp(join(tmpdir(), 'stacks-install-fifo-'))
  try {
    return await run(scratch)
  }
  finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

function start(script: string, cwd: string, env: Record<string, string>) {
  return Bun.spawn(['/bin/bash', script], { cwd, env, stdout: 'pipe', stderr: 'pipe', timeout: 15_000 })
}

async function finish(child: ReturnType<typeof start>) {
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

test('each run names its own FIFO under its own temporary directory, never the shared /tmp/mypipe', async () => {
  await withScratch(async (scratch) => {
    const seen: string[] = []
    for (const name of ['one', 'two']) {
      const { root, script, env } = await project(scratch, name, 'echo setup')
      const boundary = join(root, 'boundary')
      const recorded = join(root, 'recorded')
      // Stop at the OS boundary: record what would be created, create nothing.
      await writeFile(boundary, 'mkfifo() { printf "%s\\n" "$*" >> "$RECORDED"; exit 91; }\n')
      const result = await finish(start(script, root, { ...env, BASH_ENV: boundary, RECORDED: recorded }))
      expect(result.code, result.stderr).toBe(91)
      const path = (await readFile(recorded, 'utf8')).trim()
      expect(path).not.toBe('/tmp/mypipe')
      expect(path.startsWith(`${env.TMPDIR}/`)).toBe(true)
      seen.push(path)
      // Stopping at the boundary still cleans up what the run made.
      expect(await readdir(env.TMPDIR)).toEqual([])
    }
    expect(new Set(seen).size).toBe(2)
  })
})

test('two runs at once keep their streams apart and leave nothing behind', async () => {
  await withScratch(async (scratch) => {
    const shared = join(scratch, 'shared-tmp')
    await mkdir(shared)
    const setup = 'for n in 1 2 3 4 5; do echo "$TAG line $n"; sleep 0.05; done'
    const runs = await Promise.all(['alpha', 'beta'].map(async (tag) => {
      const made = await project(scratch, tag, setup)
      const env = { ...made.env, TMPDIR: shared, TAG: tag }
      return { tag, made, child: start(made.script, made.root, env) }
    }))
    const results = await Promise.all(runs.map(async run => ({ run, result: await finish(run.child) })))
    for (const { run, result } of results) {
      expect(result.code, result.stderr).toBe(0)
      const other = run.tag === 'alpha' ? 'beta' : 'alpha'
      const logged = (await readFile(join(run.made.root, 'storage/logs/console.log'), 'utf8')).trim().split('\n')
      expect(logged).toHaveLength(5)
      for (const [index, line] of logged.entries()) {
        expect(line).toMatch(new RegExp(`^\\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\] ${run.tag} line ${index + 1}$`))
        expect(line).not.toContain(other)
      }
      // The console still shows the stream too.
      expect(result.stdout).toContain(`${run.tag} line 5`)
      expect(result.stdout).not.toContain(other)
    }
    expect(await readdir(shared)).toEqual([])
  })
})

test('a failed setup keeps its exit status, its log, and removes its FIFO', async () => {
  await withScratch(async (scratch) => {
    const { root, script, env } = await project(scratch, 'failing', 'echo "starting"; echo "broke" >&2; exit 7')
    const result = await finish(start(script, root, env))
    expect(result.code, result.stderr).toBe(7)
    expect(result.stdout).toContain('starting')
    expect(await readFile(join(root, 'storage/logs/console.log'), 'utf8')).toContain('starting')
    expect(await readdir(env.TMPDIR)).toEqual([])
  })
})

test('an interrupted run stops its setup, fails, and removes its FIFO', async () => {
  await withScratch(async (scratch) => {
    const marker = 'running'
    const { root, script, env } = await project(scratch, 'interrupted', `echo ${marker}; exec sleep 31.7`)
    const child = start(script, root, env)
    const decoder = new TextDecoder()
    let output = ''
    const reader = child.stdout.getReader()
    const deadline = performance.now() + 10_000
    while (!output.includes(marker) && performance.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) break
      output += decoder.decode(value)
    }
    expect(output).toContain(marker)
    child.kill('SIGTERM')
    const code = await child.exited
    expect(code).not.toBe(0)
    // The stand-in setup, a 31.7 second sleep, must not outlive the run.
    const lingering = Bun.spawnSync(['/bin/ps', '-axo', 'command='], { stdout: 'pipe' }).stdout.toString()
    expect(lingering).not.toContain('sleep 31.7')
    expect(await readdir(env.TMPDIR)).toEqual([])
  })
})


test('interruption also stops a logger blocked in its timestamp command', async () => {
  await withScratch(async (scratch) => {
    const { root, script, env } = await project(scratch, 'timestamp-interrupted', 'echo running; exec sleep 31.8')
    await rm(join(root, 'bin/date'))
    await executable(join(root, 'bin/date'), 'echo timestamping >&2; exec sleep 31.9')
    const child = start(script, root, env)
    const output = new Response(child.stdout).text()
    const reader = child.stderr.getReader()
    let stderr = ''
    try {
      while (!stderr.includes('timestamping')) {
        const { value, done } = await reader.read()
        if (done) break
        stderr += new TextDecoder().decode(value)
      }
      expect(stderr).toContain('timestamping')
      child.kill('SIGTERM')
      expect(await child.exited).not.toBe(0)
      await output
      const lingering = Bun.spawnSync(['/bin/ps', '-axo', 'command='], { stdout: 'pipe' }).stdout.toString()
      expect(lingering).not.toContain('sleep 31.8')
      expect(lingering).not.toContain('sleep 31.9')
      expect(await readdir(env.TMPDIR)).toEqual([])
    }
    finally {
      reader.releaseLock()
      child.kill('SIGTERM')
    }
  })
})
