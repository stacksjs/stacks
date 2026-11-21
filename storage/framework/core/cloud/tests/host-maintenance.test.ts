import type { DeployArchive } from '../src/host-backup/deploy-archives'
import { expect, test } from 'bun:test'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archiveDeploymentBackups, deploymentBackups } from '../src/host-backup/deploy-archives'
import { withScratch } from '../src/host-backup/io'
import { day, releaseCandidates, tryFileLock } from '../src/host-backup/maintenance'

test('release cleanup preserves current and rollback releases, newer releases and paths used by the host', async () => {
  await withScratch(join(tmpdir(), 'maintenance-site-'), async (site) => {
    const releases = join(site, 'releases')
    mkdirSync(releases)
    mkdirSync(join(site, '.ts-cloud'))
    const now = Date.now()
    const ids = ['aaaaaaa', 'bbbbbbb', 'ccccccc', 'ddddddd', 'eeeeeee', 'fffffff', '1111111']
    for (const [index, id] of ids.entries()) {
      const path = join(releases, id)
      mkdirSync(path)
      const age = new Date(now - (index + 2) * day)
      utimesSync(path, age, age)
    }
    symlinkSync('releases/ccccccc', join(site, 'current'))
    symlinkSync('fffffff', join(releases, '2222222'))
    writeFileSync(join(site, '.ts-cloud/previous-release'), 'ddddddd\n')
    const realSite = realpathSync(site)
    const references = new Set([join(realSite, 'releases/eeeeeee/submount'), join(realSite, 'releases/1111111/bun')])
    expect(releaseCandidates(site, references, now)).toEqual([join(realSite, 'releases/fffffff')])
  })
})

test.skipIf(!Bun.which('flock'))('retains the same flock inode until the protected work ends', async () => {
  await withScratch(join(tmpdir(), 'maintenance-lock-'), async (root) => {
    const lock = join(root, 'deploy.lock')
    expect(await tryFileLock(lock)).toBeUndefined()
    const release = await tryFileLock(lock, true)
    expect(release).toBeDefined()
    try {
      expect(await tryFileLock(lock)).toBeUndefined()
    }
    finally {
      release?.()
    }
    const next = await tryFileLock(lock)
    expect(next).toBeDefined()
    next?.()
  })
})

test('removes an aged dump only after byte-for-byte restores from both providers and a durable receipt', async () => {
  await withScratch(join(tmpdir(), 'maintenance-backup-'), async (directory) => {
    const files = [10, 11, 12].map(day => join(directory, `2026-11-${day}T12-00-00.postgres.sql`))
    const now = Date.now()
    const aged = new Date(now - 2 * day)
    for (const file of files) {
      writeFileSync(file, 'original backup')
      utimesSync(file, aged, aged)
    }
    const receipts = join(directory, 'receipts')
    const plan = deploymentBackups(directory, new Set(), now)
    expect(plan.removals.map(file => file.path)).toEqual([files[0]])
    const archive = (id: string, corrupt = false): DeployArchive => ({
      run: async (command) => {
        if (command === 'backup')
          return JSON.stringify({ message_type: 'summary', snapshot_id: id })
        if (command === 'cat')
          return JSON.stringify({ paths: files })
        throw new Error(`Unexpected repository command: ${command}`)
      },
      restore: async (_snapshot, path, target) => {
        if (corrupt)
          writeFileSync(target, 'wrong backup')
        else
          copyFileSync(path, target)
      },
    })
    await expect(archiveDeploymentBackups(directory, 'fixture', plan, { aws: archive('aws-id'), hetzner: archive('hetzner-id', true) }, receipts))
      .rejects.toThrow('restore verification failed')
    expect(existsSync(files[0]!)).toBe(true)
    expect(existsSync(join(receipts, 'fixture.jsonl'))).toBe(false)
    await archiveDeploymentBackups(directory, 'fixture', plan, { aws: archive('aws-id'), hetzner: archive('hetzner-id') }, receipts)
    expect(existsSync(files[0]!)).toBe(false)
    expect(files.slice(1).every(file => existsSync(file))).toBe(true)
    const receipt = JSON.parse(readFileSync(join(receipts, 'fixture.jsonl'), 'utf8'))
    expect(receipt).toMatchObject({ path: files[0], snapshot: 'aws-id', replicas: { aws: 'aws-id', hetzner: 'hetzner-id' } })
  })
})
