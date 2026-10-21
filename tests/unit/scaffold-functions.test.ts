import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

for (const directory of ['resources/functions', 'storage/framework/defaults/resources/functions']) {
  test(`${directory} imports on the server without template globals`, () => {
    const counter = resolve(directory, 'counter.ts'), dark = resolve(directory, 'dark.ts')
    const script = `
      if (typeof globalThis.state !== 'undefined' || typeof globalThis.useDark !== 'undefined')
        throw new Error('The fixture must not supply template globals')
      const counter = await import(${JSON.stringify(counter)})
      const initial = counter.count()
      counter.increment()
      if (counter.count() !== initial + 1) throw new Error('Counter did not increment')
      const dark = await import(${JSON.stringify(dark)})
      const before = dark.isDark()
      dark.toggleDark()
      if (dark.isDark() !== !before) throw new Error('Dark mode did not toggle')
      if (typeof dark.preferredDark() !== 'boolean') throw new Error('Missing system preference')
    `
    const result = Bun.spawnSync([process.execPath, '--no-env-file', '-e', script], {
      cwd: tmpdir(), stdout: 'pipe', stderr: 'pipe',
    })
    expect(result.stderr.toString()).toBe('')
    expect(result.exitCode).toBe(0)
  })
}
