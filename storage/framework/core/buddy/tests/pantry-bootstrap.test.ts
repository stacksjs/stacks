import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '@stacksjs/testing/isolated'

const installer = resolve(import.meta.dir, '../../../scripts/pantry-install')
type FixtureEnv = { PATH: string, HOME: string, TMPDIR: string, PANTRY_VERSION: string, CALLS: string, NETWORK: string }

async function executable(file: string, source: string): Promise<void> {
  await writeFile(file, `#!/bin/sh\n${source}\n`, { mode: 0o755 })
}

async function fixture<T>(run: (root: string, env: FixtureEnv) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-pantry-bootstrap-'))
  try {
    await mkdir(join(root, 'bin'))
    await mkdir(join(root, 'home'))
    await mkdir(join(root, 'downloads'))
    await symlink('/usr/bin/mktemp', join(root, 'bin/mktemp'))
    await symlink('/bin/rm', join(root, 'bin/rm'))
    const env = { PATH: join(root, 'bin'), HOME: join(root, 'home'), TMPDIR: join(root, 'downloads'), PANTRY_VERSION: '9.8.7', CALLS: join(root, 'calls'), NETWORK: join(root, 'network') }
    for (const name of ['curl', 'bash'])
      await executable(join(root, 'bin', name), 'printf "%s\\n" "$0 $*" >> "$NETWORK"; exit 97')
    return await run(root, env)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function shell(file: string, root: string, env: Record<string, string>, args: string[] = [], interpreter = '/bin/sh') {
  const child = Bun.spawn([interpreter, file, ...args], { cwd: root, env, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

async function actionShell(root: string): Promise<string> {
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
  const generated = await runIsolated(generate, { cwd: root, inheritEnv: false, env: { APP_ENV: 'development', NODE_ENV: 'development' }, envFile: false, preload: [], timeoutMs: 10_000 })
  expect(generated.code, generated.stderr).toBe(0)
  return output
}

async function downloadFixture(root: string, env: FixtureEnv, payloadSource: string, status = '0'): Promise<Record<string, string>> {
  const payload = join(root, 'installer-payload.sh')
  await writeFile(payload, payloadSource)
  await executable(join(root, 'bin/curl'), `
    output=
    while [ "$#" -gt 0 ]; do
      case "$1" in
        -o) output=$2; shift 2 ;;
        -fsSL|https://pantry.dev) shift ;;
        *) exit 98 ;;
      esac
    done
    printf "curl\\n" >> "$NETWORK"
    if [ -n "$output" ]; then /bin/cp "$PAYLOAD" "$output"; else /bin/cat "$PAYLOAD"; fi
    exit "$CURL_STATUS"
  `)
  await unlink(join(root, 'bin/bash'))
  await symlink('/bin/bash', join(root, 'bin/bash'))
  return { ...env, PAYLOAD: payload, CURL_STATUS: status }
}

test('the installer rejects an existing Pantry that differs from the explicit download pin', async () => {
  await fixture(async (root, env) => {
    await executable(join(root, 'bin/pantry'), 'printf "%s\\n" "$*" >> "$CALLS"; printf "pantry 9.8.6 (fixture)\\n"')
    const result = await shell(installer, root, env)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain('9.8.7')
    expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
    expect(await Bun.file(env.NETWORK).exists()).toBe(false)
  })
})

for (const [name, output, status] of [
  ['newer', 'pantry 9.8.8 (fixture)', '0'],
  ['version-prefix collision', 'pantry 9.8.70 (fixture)', '0'],
  ['malformed', 'not-pantry 9.8.7', '0'],
  ['nonfunctional', 'pantry 9.8.7 (fixture)', '42'],
] as const) {
  test(`the installer rejects an existing ${name} command without changing the installation`, async () => {
    await fixture(async (root, env) => {
      await executable(join(root, 'bin/pantry'), 'printf "%s\\n" "$*" >> "$CALLS"; printf "%s\\n" "$VERSION_OUTPUT"; exit "$VERSION_STATUS"')
      const result = await shell(installer, root, { ...env, VERSION_OUTPUT: output, VERSION_STATUS: status })
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('9.8.7')
      expect(result.stderr).toContain('PATH')
      expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
      expect(await Bun.file(env.NETWORK).exists()).toBe(false)
      expect(await readdir(env.HOME)).toEqual([])
    })
  })
}

for (const explicit of [false, true]) {
  test(`the installer accepts its ${explicit ? 'explicit' : 'default'} exact pin after probing it`, async () => {
    await fixture(async (root, env) => {
      const version = explicit ? env.PANTRY_VERSION : (await readFile(installer, 'utf8')).match(/PANTRY_VERSION:-([0-9.]+)/)?.[1]
      if (!version) throw new Error('The installer must declare a default download pin')
      const childEnv: Record<string, string> = { ...env, VERSION_OUTPUT: `pantry ${version} (fixture)` }
      if (!explicit) delete childEnv.PANTRY_VERSION
      await executable(join(root, 'bin/pantry'), 'printf "%s\\n" "$*" >> "$CALLS"; printf "%s\\n" "$VERSION_OUTPUT"')
      const result = await shell(installer, root, childEnv)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
      expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
      expect(await Bun.file(env.NETWORK).exists()).toBe(false)
      expect(await readdir(env.HOME)).toEqual([])
    })
  })
}

for (const matches of [false, true]) {
  test(`the installer verifies ${matches ? 'matching' : 'mismatched'} output from a successful installer process`, async () => {
    await fixture(async (root, env) => {
      const staged = join(root, 'staged-pantry')
      await executable(staged, 'printf "%s\\n" "$*" >> "$CALLS"; printf "%s\\n" "$VERSION_OUTPUT"')
      // Return an authored installer payload from the network boundary. The
      // real Bash must execute the downloaded file before identity is checked.
      const childEnv = await downloadFixture(root, env, '/bin/mkdir -p "$HOME/.local/bin"; /bin/cp "$STAGED" "$HOME/.local/bin/pantry"; printf "%s\\n" "$PANTRY_VERSION" > "$INSTALLED_PIN"')
      const installedPin = join(root, 'installed-pin')
      const result = await shell(installer, root, { ...childEnv, STAGED: staged, INSTALLED_PIN: installedPin, VERSION_OUTPUT: `pantry ${matches ? env.PANTRY_VERSION : '9.8.6'} (fixture)` })
      expect(result.code, result.stderr).toBe(matches ? 0 : 1)
      expect(await readFile(installedPin, 'utf8')).toBe(`${env.PANTRY_VERSION}\n`)
      expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
      expect(await readFile(env.NETWORK, 'utf8')).toBe('curl\n')
      expect(await Bun.file(join(env.HOME, '.profile')).exists()).toBe(false)
      expect(await readdir(env.TMPDIR)).toEqual([])
    })
  })
}

for (const mode of ['quiet', 'verbose']) {
  test(`the actual InstallAction shell propagates installer failure in ${mode} mode`, async () => {
    await fixture(async (root, env) => {
      await mkdir(join(root, 'storage/framework/core'), { recursive: true })
      await mkdir(join(root, 'storage/framework/scripts'))
      await symlink(installer, join(root, 'storage/framework/scripts/pantry-install'))
      await symlink('/usr/bin/dirname', join(root, 'bin/dirname'))
      await executable(join(root, 'bin/pantry'), 'printf "%s\\n" "$*" >> "$CALLS"; printf "pantry 9.8.6 (fixture)\\n"')
      const output = await actionShell(root)

      // A broken caller must not touch its global /tmp/mypipe or launch setup.
      // Intercept that OS boundary in the shell, without rewriting its script.
      const boundary = join(root, 'shell-boundary')
      await writeFile(boundary, 'mkfifo() { printf "%s\\n" "$*" >> "$CONTINUED"; exit 91; }\n')
      const continued = join(root, 'continued')
      const result = await shell(output, root, { ...env, BASH_ENV: boundary, CONTINUED: continued }, mode === 'verbose' ? ['--verbose'] : [], '/bin/bash')
      expect(result.code, result.stderr).toBe(1)
      expect(result.stderr).toContain('9.8.7')
      expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
      expect(await Bun.file(continued).exists()).toBe(false)
      expect(await Bun.file(env.NETWORK).exists()).toBe(false)
    })
  })
}

test('the actual InstallAction clone path reports installer failure before claiming project creation', async () => {
  await fixture(async (root, env) => {
    await executable(join(root, 'bin/pantry'), 'printf "%s\\n" "$*" >> "$CALLS"; printf "pantry 9.8.6 (fixture)\\n"')
    // Model the git boundary using an owned empty checkout, without a clone or
    // network access. Its installer is still the unchanged framework script.
    await executable(join(root, 'bin/git'), '/bin/mkdir -p "$3/storage/framework/scripts"; /bin/ln -s "$INSTALLER" "$3/storage/framework/scripts/pantry-install"')
    const output = await actionShell(root)
    const result = await shell(output, root, { ...env, INSTALLER: installer }, ['fixture-project'], '/bin/bash')
    expect(result.code, result.stderr).toBe(1)
    expect(result.stderr).toContain('9.8.7')
    expect(result.stdout).not.toContain('has been created')
    expect(await readFile(env.CALLS, 'utf8')).toBe('--version\n')
    expect(await Bun.file(env.NETWORK).exists()).toBe(false)
  })
})

test('a failed download cannot be hidden by an installer that would create a matching command', async () => {
  await fixture(async (root, env) => {
    const staged = join(root, 'staged-pantry')
    const installerCalled = join(root, 'installer-called')
    await executable(staged, 'printf "%s\\n" "$*" >> "$CALLS"; printf "pantry 9.8.7 (fixture)\\n"')
    const childEnv = await downloadFixture(root, env, 'printf "called\\n" > "$INSTALLER_CALLED"; /bin/mkdir -p "$HOME/.local/bin"; /bin/cp "$STAGED" "$HOME/.local/bin/pantry"', '23')
    const result = await shell(installer, root, { ...childEnv, STAGED: staged, INSTALLER_CALLED: installerCalled })
    expect(result.code, result.stderr).toBe(23)
    expect(result.stderr).toContain('download')
    expect(await Bun.file(installerCalled).exists()).toBe(false)
    expect(await Bun.file(env.CALLS).exists()).toBe(false)
    expect(await readdir(env.TMPDIR)).toEqual([])
    expect(await readdir(env.HOME)).toEqual([])
  })
})

test('a failed installer cannot be accepted even after it writes a matching command', async () => {
  await fixture(async (root, env) => {
    const staged = join(root, 'staged-pantry')
    await executable(staged, 'printf "%s\\n" "$*" >> "$CALLS"; printf "pantry 9.8.7 (fixture)\\n"')
    const childEnv = await downloadFixture(root, env, '/bin/mkdir -p "$HOME/.local/bin"; /bin/cp "$STAGED" "$HOME/.local/bin/pantry"; exit 42')
    const result = await shell(installer, root, { ...childEnv, STAGED: staged })
    expect(result.code).toBe(42)
    expect(result.stderr).toContain('installer failed')
    expect(await Bun.file(env.CALLS).exists()).toBe(false)
    expect(await readdir(env.TMPDIR)).toEqual([])
  })
})

test('a successful installer that creates no Pantry command is rejected', async () => {
  await fixture(async (root, env) => {
    const childEnv = await downloadFixture(root, env, 'exit 0')
    const result = await shell(installer, root, childEnv)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Could not run pantry --version')
    expect(await readdir(env.TMPDIR)).toEqual([])
  })
})

test('termination during the installer removes the owned download file', async () => {
  await fixture(async (root, env) => {
    const childEnv = await downloadFixture(root, env, 'kill -TERM "$PPID"')
    const result = await shell(installer, root, childEnv)
    expect(result.code).toBe(143)
    expect(await readdir(env.TMPDIR)).toEqual([])
    expect(await readdir(env.HOME)).toEqual([])
  })
})
