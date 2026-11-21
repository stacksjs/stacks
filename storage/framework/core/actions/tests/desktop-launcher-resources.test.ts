import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stageLauncherViews } from '../src/build/desktop-launcher-resources'

test('packages the declared desktop routes and their local assets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-desktop-resources-test-'))
  const source = join(root, 'site')
  const output = join(root, 'bundle')
  try {
    await Bun.write(join(source, 'app.html'), '<link rel="stylesheet" href="/app.css"><img src="/tray.png">')
    await Bun.write(join(source, 'app/settings.html'), '<script src="/settings.js"></script>')
    await Bun.write(join(source, 'app.css'), '.icon { background: url("/background.png") }')
    for (const file of ['settings.js', 'chunk.js', 'tray.png', 'background.png', 'marketing.html', 'marketing.jpg'])
      await Bun.write(join(source, file), 'asset')

    await stageLauncherViews(source, output, ['/app'])

    expect([...new Bun.Glob('**/*').scanSync({ cwd: output, onlyFiles: true })].sort()).toEqual([
      'app.css', 'app.html', 'app/settings.html', 'background.png', 'chunk.js', 'settings.js', 'tray.png',
    ])
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
