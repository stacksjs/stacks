import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activeSiteModePayload, comingSoonFilePath, maintenanceFilePath, maintenancePayload } from '../../src/maintenance'

const originalCwd = process.cwd()
const root = await realpath(await mkdtemp(join(tmpdir(), 'stacks-mode-paths-')))
const first = join(root, 'first')
const second = join(root, 'second')
process.env.APP_MAINTENANCE = 'false'
process.env.APP_COMING_SOON = 'false'
try {
  await mkdir(join(first, 'storage/framework/runtime'), { recursive: true })
  await mkdir(join(second, 'storage/framework'), { recursive: true })
  // Revisit the first project, including from inside storage/, after resolving
  // another project's filenames. No framework path or file APIs are mocked.
  for (const [cwd, project] of [[first, first], [second, second], [join(first, 'storage/framework/runtime'), first], [first, first]]) {
    process.chdir(cwd)
    const down = join(project, 'storage/framework/down')
    const comingSoon = join(project, 'storage/framework/coming-soon')
    assert.equal(maintenanceFilePath(), down)
    assert.equal(comingSoonFilePath(), comingSoon)
    assert.equal(await activeSiteModePayload(), null)

    await Bun.write(down, JSON.stringify({ time: 1, message: 'First payload' }))
    assert.equal((await maintenancePayload())?.message, 'First payload')
    await Bun.write(down, JSON.stringify({ time: 2, message: 'Updated payload' }))
    assert.equal((await maintenancePayload())?.message, 'Updated payload')
    await Bun.write(comingSoon, JSON.stringify({ time: 3 }))
    assert.equal((await activeSiteModePayload())?.mode, 'maintenance')
    await rm(down)
    assert.equal((await activeSiteModePayload())?.mode, 'coming-soon')
    await rm(comingSoon)
    assert.equal(await activeSiteModePayload(), null)
  }
}
finally {
  process.chdir(originalCwd)
  await rm(root, { recursive: true, force: true })
}
