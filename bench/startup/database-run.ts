import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { hostEnvironment } from '../routing/runtime'
import { readRuntimeRequirement } from '../routing/runtime-version'
import { readBuiltGraph } from './graph'
import { readSourceSnapshot } from './provenance'
import type { StartupSample } from './statistics'
import { parseStartupOptions, startupSampleCommand, startupSchedule } from './config'
import { parseProcessSample } from './sample-result'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'

export async function runDatabaseRuntimeBenchmark(args = process.argv.slice(2)): Promise<object> {
  const options = parseStartupOptions(args, 'bench/startup/results/database-latest.json')
  const here = import.meta.dir
  const repositoryRoot = resolve(here, '../..')
  const packageRoot = join(repositoryRoot, 'storage/framework/core/database')
  const distRoot = join(packageRoot, 'dist')
  const entries = {
    root: join(distRoot, 'index.js'),
    runtime: join(distRoot, 'runtime.js'),
  }
  const requirement = await readRuntimeRequirement(repositoryRoot)
  if (!requirement?.matches)
    throw new Error(`Bun ${Bun.version} does not satisfy the benchmark runtime requirement ${requirement?.range ?? '(missing)'}`)

  const manifest = await Bun.file(join(packageRoot, 'package.json')).json() as { name?: string, version?: string }
  if (!manifest.name || !manifest.version)
    throw new Error('Database package manifest is missing its name or version')

  const sourceBefore = await readSourceSnapshot(repositoryRoot)
  const graphsBefore = {
    root: await readBuiltGraph(entries.root, distRoot),
    runtime: await readBuiltGraph(entries.runtime, distRoot),
  }
  const samples: StartupSample[] = []

  for (const scheduled of startupSchedule(options.pairs)) {
    const child = Bun.spawnSync(startupSampleCommand(
      process.execPath,
      join(here, 'bunfig.toml'),
      join(here, 'database-sample.ts'),
      entries[scheduled.variant],
    ), {
      cwd: here,
      env: {
        ...hostEnvironment(),
        APP_ENV: 'production',
        NODE_ENV: 'production',
      },
    })
    if (child.exitCode !== 0)
      throw new Error(`Database sample ${scheduled.pair}/${scheduled.variant} failed: ${child.stderr.toString().trim()}`)
    samples.push({
      ...scheduled,
      ...parseProcessSample(child.stdout.toString(), child.stderr.toString()),
    })
  }

  validateStartupSamples(samples, options.pairs)
  const sourceAfter = await readSourceSnapshot(repositoryRoot)
  if (sourceBefore.revision !== sourceAfter.revision || sourceBefore.fingerprint !== sourceAfter.fingerprint)
    throw new Error('Repository source changed during the database runtime benchmark')
  const graphsAfter = {
    root: await readBuiltGraph(entries.root, distRoot),
    runtime: await readBuiltGraph(entries.runtime, distRoot),
  }
  if (graphsBefore.root.digest !== graphsAfter.root.digest || graphsBefore.runtime.digest !== graphsAfter.runtime.digest)
    throw new Error('Built database graph changed during the database runtime benchmark')

  const processors = cpus()
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    diagnosticReason: 'Fresh-process import comparison. Hosted runners are not dedicated benchmark hardware.',
    generatedAt: new Date().toISOString(),
    runtime: {
      name: 'Bun',
      version: Bun.version,
      executable: process.execPath,
      requirement,
    },
    host: {
      platform: platform(),
      release: release(),
      architecture: arch(),
      logicalCpuCount: processors.length,
      cpuModel: processors[0]?.model ?? null,
      totalMemoryBytes: totalmem(),
    },
    source: {
      before: sourceBefore,
      after: sourceAfter,
      changedDuringRun: false,
    },
    packages: {
      database: {
        name: manifest.name,
        version: manifest.version,
        manifest: relative(repositoryRoot, join(packageRoot, 'package.json')),
      },
    },
    entries: {
      root: relative(repositoryRoot, entries.root),
      runtime: relative(repositoryRoot, entries.runtime),
    },
    staticGraph: {
      root: graphsBefore.root,
      runtime: graphsBefore.runtime,
      fileCountDelta: graphsBefore.runtime.fileCount - graphsBefore.root.fileCount,
      byteDelta: graphsBefore.runtime.totalBytes - graphsBefore.root.totalBytes,
      bytePercentChange: ((graphsBefore.runtime.totalBytes / graphsBefore.root.totalBytes) - 1) * 100,
    },
    pairs: options.pairs,
    importMs: summarizeStartupMetric(samples, options.pairs, 'importMs'),
    rssBytes: summarizeStartupMetric(samples, options.pairs, 'rssBytes'),
    samples,
  }

  const output = resolve(repositoryRoot, options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

if (import.meta.main)
  await runDatabaseRuntimeBenchmark()
