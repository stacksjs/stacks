/**
 * Take a dump and put it back, under whichever Bun runs this file.
 *
 * Run by `database-backup-min-bun.test.ts` with the oldest supported Bun, and
 * by hand to measure a large dump:
 *
 *   bun x bun@1.3.14 tests/fixtures/database-backup-under-bun.ts <megabytes> [pipe|process]
 *
 * The "database" is a shell loop printing SQL, so no file the size of the dump
 * is needed to produce it, and the restore target is `cksum`, so none is
 * needed to check it either. Prints one JSON line per path and exits non-zero
 * when a round trip does not match.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { readDump, writeDump } from '../../src/database-backup'

const megabytes = Number(process.argv[2] ?? 64)
const paths = (process.argv[3] ? [process.argv[3]] : ['pipe', 'process']) as Array<'pipe' | 'process'>

// 128 bytes a row, so the size asked for is the size produced.
const row = `INSERT INTO events (id, fingerprint, message) VALUES (424242, 'c0ffee', '${'x'.repeat(59)}');`.padEnd(127, ' ')
const rows = megabytes * 8192
// DUMP_FIXTURE_PRODUCE swaps in another producer, for a measurement on less
// compressible data than one repeated row.
const produce = process.env.DUMP_FIXTURE_PRODUCE || `yes "${row}" | head -n ${rows}`

function sh(script: string): { bin: string, args: string[], env: Record<string, string> } {
  return { bin: 'sh', args: ['-c', script], env: {} }
}

function megabytesOf(bytes: number): number {
  return Math.round(bytes / 1024 / 1024)
}

const expected = new TextDecoder().decode(Bun.spawnSync(['sh', '-c', `${produce} | cksum`]).stdout).trim()
const dir = mkdtempSync(join(tmpdir(), 'stacks-dump-under-bun-'))
let failed = false

try {
  for (const via of paths) {
    const dump = join(dir, `2026-11-11T00-00-00-000.postgres.${via}.sql.gz`)
    const sum = join(dir, `${via}.cksum`)

    let peak = 0
    const sample = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage.rss())
    }, 25)

    const started = performance.now()
    await writeDump(sh(produce), dump, undefined, { via })
    const written = performance.now()
    await readDump(sh(`cksum > '${sum}'`), dump, undefined, { via })
    const restored = performance.now()

    clearInterval(sample)
    peak = Math.max(peak, process.memoryUsage.rss())

    const actual = (await Bun.file(sum).text()).trim()
    const matches = actual === expected
    failed ||= !matches

    console.log(JSON.stringify({
      bun: Bun.version,
      via,
      dumpMB: megabytes,
      gzipMB: megabytesOf(statSync(dump).size),
      writeSeconds: Number(((written - started) / 1000).toFixed(1)),
      restoreSeconds: Number(((restored - written) / 1000).toFixed(1)),
      peakRssMB: megabytesOf(peak),
      roundTrip: matches,
    }))

    rmSync(dump, { force: true })
  }
}
finally {
  rmSync(dir, { recursive: true, force: true })
}

process.exit(failed ? 1 : 0)
