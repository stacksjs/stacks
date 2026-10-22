import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { waitForBrowserPort } from '../../../defaults/ai/skills/stacks-browse/scripts/browse'

async function fixture(run: (file: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'browse-startup-readiness-'))
  try { await run(join(root, 'DevToolsActivePort')) }
  finally { rmSync(root, { recursive: true, force: true }) }
}

test('startup observes the browser-written port when it actually becomes ready', async () => {
  await fixture(async (file) => {
    writeFileSync(file, 'partial')
    const timer = setTimeout(() => writeFileSync(file, '9515\n/devtools/browser/fixture\n'), 30)
    try { expect(await waitForBrowserPort({ exitCode: null }, file, 1000)).toBe(9515) }
    finally { clearTimeout(timer) }
  })
})

test('a missing port remains a bounded launch failure', async () => {
  await fixture(async (file) => {
    expect(await waitForBrowserPort({ exitCode: null }, file, 40)).toBeNull()
  })
})

test('a stale port cannot admit a browser that already exited', async () => {
  await fixture(async (file) => {
    writeFileSync(file, '9515\n')
    expect(await waitForBrowserPort({ exitCode: 1 }, file, 1000)).toBeNull()
  })
})

test('startup rejects invalid endpoint numbers and invalid budgets', async () => {
  await fixture(async (file) => {
    for (const port of ['', '0', '-1', '65536', '9515x', '1.5']) {
      writeFileSync(file, `${port}\n`)
      expect(await waitForBrowserPort({ exitCode: null }, file, 5)).toBeNull()
    }
    for (const budget of [0, -1, 0.5, 30001])
      await expect(waitForBrowserPort({ exitCode: null }, file, budget)).rejects.toThrow('startup timeout')
  })
})
