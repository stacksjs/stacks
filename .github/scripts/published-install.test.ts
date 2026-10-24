import { expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Execute the real release step. Registry metadata can exist even when an
// archive or a transitive dependency cannot be installed by a consumer.
async function verify(mode: string, registryStatus = '200') {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-published-install-'))
  const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
  const step = workflow.jobs.npm.steps.find((entry: any) => entry.name === 'Verify published framework install')
  const commands = {
    bun: `#!/bin/bash
if [ "$1" != add ]; then
  [ "$INSTALL_MODE" != cli-failure ]
  exit $?
fi
count=0
[ ! -f "$INSTALL_CALLS" ] || read -r count < "$INSTALL_CALLS"
count=$((count + 1))
echo "$count" > "$INSTALL_CALLS"
case "$INSTALL_MODE" in
  success|cli-failure) exit 0 ;;
  delayed) [ "$count" -ge 3 ] && exit 0 ;;
  workspace) echo 'error: unsupported URL type workspace:' >&2; exit 1 ;;
esac
echo 'error: No version matching "0.75.290" for specifier "@stacksjs/actions"' >&2
exit 1
`,
    curl: '#!/bin/bash\necho "$REGISTRY_STATUS"\n',
    timeout: '#!/bin/bash\nshift\nexec "$@"\n',
    sleep: '#!/bin/bash\nexit 0\n',
  }
  try {
    for (const [name, source] of Object.entries(commands)) {
      writeFileSync(join(directory, name), source)
      chmodSync(join(directory, name), 0o755)
    }
    const process = Bun.spawn(['/bin/bash', '-eo', 'pipefail', '-c', step.run], {
      env: { ...Bun.env, PATH: `${directory}:${Bun.env.PATH}`, GITHUB_REF: 'refs/tags/v0.75.290', GITHUB_STEP_SUMMARY: join(directory, 'summary'), INSTALL_CALLS: join(directory, 'calls'), INSTALL_MODE: mode, REGISTRY_STATUS: registryStatus },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, output, errors] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()])
    return { exitCode, output: output + errors, attempts: Number(readFileSync(join(directory, 'calls'), 'utf8')) }
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('registry metadata cannot substitute for a successful clean install', async () => {
  const result = await verify('unavailable')
  expect(result.attempts).toBe(30)
  expect(result.exitCode).not.toBe(0)
  expect(result.output).toContain('::error::')
  expect(result.output).not.toContain('Continuing; no action needed')
})

test('a missing publication and an invalid workspace manifest both fail', async () => {
  expect((await verify('unavailable', '404')).exitCode).not.toBe(0)
  const invalid = await verify('workspace')
  expect(invalid.exitCode).not.toBe(0)
  expect(invalid.attempts).toBe(1)
})

test('successful and delayed installations still require an executable buddy CLI', async () => {
  const immediate = await verify('success')
  expect(immediate.exitCode).toBe(0)
  expect(immediate.attempts).toBe(1)
  const delayed = await verify('delayed')
  expect(delayed.exitCode).toBe(0)
  expect(delayed.attempts).toBe(3)
  expect(delayed.output).toContain('installs from a clean project')
  expect((await verify('cli-failure')).exitCode).not.toBe(0)
})
