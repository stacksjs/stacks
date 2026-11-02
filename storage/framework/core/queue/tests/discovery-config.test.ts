import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverJobs, getScheduledJobs, jobRegistry } from '../src/discovery'

const directories: string[] = []
afterEach(async () => {
  jobRegistry.clear()
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})
async function jobs(source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-discovery-config-'))
  directories.push(directory)
  await writeFile(join(directory, 'ConfiguredJob.ts'), source)
  return (await discoverJobs(directory))[0]!
}

test('disabled jobs stay discoverable but are excluded from scheduling', async () => {
  const found = await jobs('export default { name: "Disabled", enabled: false, rate: "* * * * *", handle() {} }')
  expect(found.config.enabled).toBe(false)
  expect(getScheduledJobs()).toEqual([])
})

test('class jobs retain cadence and retry settings', async () => {
  const found = await jobs('export default class Job { static config = { name: "Class", tries: 7, backoff: [10, 60], rate: "* * * * *", enabled: true }; handle() {} }')
  expect(found.config).toMatchObject({ tries: 7, backoff: [10, 60], rate: '* * * * *', enabled: true })
  expect(getScheduledJobs().map(job => job.name)).toEqual(['Class'])
})

test('object jobs retain overlap policy and legacy schedule spelling', async () => {
  const found = await jobs('export default { name: "Object", tries: 0, schedule: "* * * * *", withoutOverlapping: true, handle() {} }')
  expect(found.config).toMatchObject({ tries: 0, schedule: '* * * * *', withoutOverlapping: true })
  expect(getScheduledJobs().map(job => job.name)).toEqual(['Object'])
})
