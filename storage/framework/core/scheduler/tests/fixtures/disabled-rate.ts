import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runScheduler } from '../../src/run'
import { Schedule } from '../../src/schedule'

const previous = process.cwd()
const directory = await mkdtemp(join(tmpdir(), 'stacks-disabled-rate-'))
try {
  await mkdir(join(directory, 'app/Jobs'), { recursive: true })
  await writeFile(join(directory, 'app/Scheduler.ts'), 'export default () => {}')
  await writeFile(join(directory, 'app/Jobs/Disabled.ts'), 'export default { enabled: false, rate: "0 0 1 1 *", handle() {} }')
  await writeFile(join(directory, 'app/Jobs/Enabled.ts'), 'export default { enabled: true, rate: "0 0 1 1 *", handle() {} }')
  process.chdir(directory)
  await runScheduler()
  assert.equal(Schedule.isScheduled('Disabled'), false)
  assert.equal(Schedule.isScheduled('Enabled'), true)
  console.log('disabled rate OK')
}
finally {
  await Schedule.gracefulShutdown()
  process.chdir(previous)
  await rm(directory, { recursive: true, force: true })
}
