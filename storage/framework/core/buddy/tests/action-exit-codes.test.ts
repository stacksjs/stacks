import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// stacksjs/stacks#3158: a command whose action failed exited 0, because it
// awaited runAction() and dropped the Result. `buddy prepublish && npm publish`
// published without a build. build:functions, build:libs and
// build:web-components were fixed this way before; these were missed.
const commands = [
  ['build:cli', 'build/cli'],
  ['build:server', 'build/server'],
  ['build:frontend', 'build/views'],
  ['build:docs', 'build/docs'],
  ['build:frontend-static', 'build/frontend-static'],
  ['prepublish', 'prepublish'],
  // Already honest, as the control: the same harness must see it exit 1.
  ['build:functions', 'build-function-lib'],
] as const

describe('a buddy command whose action fails exits non-zero', () => {
  for (const [command, action] of commands) {
    test(command, async () => {
      const directory = mkdtempSync(join(tmpdir(), 'stacks-action-exit-'))
      try {
        const config = join(directory, 'bunfig.toml')
        writeFileSync(config, 'preload = []\n')
        const child = Bun.spawn([process.execPath, `--config=${config}`, `--preload=${join(import.meta.dir, 'fixtures/failing-actions.ts')}`, join(import.meta.dir, 'fixtures/action-exit-codes.ts'), command], {
          cwd: join(import.meta.dir, '../../../../..'),
          env: { ...process.env, APP_ENV: 'test' },
          stdout: 'pipe', stderr: 'pipe',
        })
        const watchdog = setTimeout(() => child.kill(), 20_000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          expect(stdout, stderr).toContain(`ran ${action}`)
          expect(code, `${stdout}\n${stderr}`).toBe(1)
        }
        finally { clearTimeout(watchdog) }
      }
      finally { rmSync(directory, { recursive: true, force: true }) }
    }, 25_000)
  }
})
