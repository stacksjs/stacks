import { copyFileSync, existsSync, globSync, lstatSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { atomicWrite, command, digest, readJson, requireRoot, withScratch } from '../../storage/framework/core/cloud/src/host-backup/io'
import { deploymentsVolume } from './inventory'

const { values: { apply } } = parseArgs({ options: { apply: { type: 'boolean' } } })
const source = import.meta.dir
const installPath = '/usr/local/sbin/stacks-host-ops'
const baselines = readJson<Record<string, { target: string, baseline: string, reviewed: string }>>(join(source, 'operator-baseline.json'))
for (const { target, baseline, reviewed } of Object.values(baselines)) {
  if (!lstatSync(target).isFile() || ![baseline, reviewed].includes(await digest(target)))
    throw new Error(`Operator changed since review. Preserving ${target}`)
}
console.log(`Verified ${Object.keys(baselines).length} operator baselines`)

if (apply) {
  requireRoot()
  await command(['mountpoint', '-q', deploymentsVolume])
  const recovery = join(deploymentsVolume, 'recovery/operators')
  mkdirSync(recovery, { recursive: true, mode: 0o700 })
  await withScratch(join(recovery, '.build-'), async (scratch) => {
    const binary = join(scratch, 'stacks-host-ops')
    await command([process.execPath, 'build', '--compile', '--no-compile-autoload-dotenv', '--no-compile-autoload-bunfig', join(source, 'operator.ts'), '--outfile', binary])
    const help = await command([binary, '--help'])
    if (!help.includes('host-backup'))
      throw new Error('Built operator failed its smoke check')

    const saved = join(recovery, new Date().toISOString().replaceAll(':', '') + '-' + crypto.randomUUID())
    mkdirSync(saved, { mode: 0o700 })
    for (const [name, { target }] of Object.entries(baselines))
      copyFileSync(target, join(saved, name))
    if (existsSync(installPath))
      copyFileSync(installPath, join(saved, 'stacks-host-ops'))
    atomicWrite(installPath, readFileSync(binary), 0o755)
    for (const path of globSync('*.service.d/disk-recovery.conf', { cwd: join(source, 'systemd') })) {
      const target = join('/etc/systemd/system', path)
      mkdirSync(dirname(target), { recursive: true })
      if (existsSync(target))
        copyFileSync(target, join(saved, path.replaceAll('/', '-')))
      atomicWrite(target, readFileSync(join(source, 'systemd', path)), 0o644)
    }
    await command(['systemctl', 'daemon-reload'])
    console.log(`Installed reviewed operators. Previous versions retained at ${saved}`)
  })
}
