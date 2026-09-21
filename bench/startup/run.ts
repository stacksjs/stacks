import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { readRuntimeRequirement } from '../routing/runtime-version'
import type { StartupSample } from './statistics'
import { parseStartupOptions, startupSampleCommand, startupSchedule } from './config'
import { readBuiltGraph } from './graph'
import { readPackageProvenance, readSourceSnapshot } from './provenance'
import { parseProcessSample } from './sample-result'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'

function graphChanged(before: Awaited<ReturnType<typeof readBuiltGraph>>, after: Awaited<ReturnType<typeof readBuiltGraph>>): boolean {
  return before.digest !== after.digest
}

export async function runStartupBenchmark(args = process.argv.slice(2)): Promise<object> {
  const options = parseStartupOptions(args)
  const here = import.meta.dir
  const repositoryRoot = resolve(here, '../..')
  const packageRoot = join(repositoryRoot, 'storage/framework/core/router')
  const distRoot = join(packageRoot, 'dist')
  const entries = {
    root: join(distRoot, 'index.js'),
    runtime: join(distRoot, 'runtime.js'),
  } as const

  const runtimeRequirement = await readRuntimeRequirement(repositoryRoot)
  if (!runtimeRequirement?.matches)
    throw new Error(`Bun ${Bun.version} does not satisfy the benchmark runtime requirement ${runtimeRequirement?.range ?? '(missing)'}`)

  const sourceBefore = await readSourceSnapshot(repositoryRoot)
  const graphsBefore = {
    root: await readBuiltGraph(entries.root, distRoot),
    runtime: await readBuiltGraph(entries.runtime, distRoot),
  }
  const packageProvenance = await readPackageProvenance(packageRoot)
  const samples: StartupSample[] = []

  for (const scheduled of startupSchedule(options.pairs)) {
    const child = Bun.spawnSync(startupSampleCommand(
      process.execPath,
      join(here, 'bunfig.toml'),
      join(here, 'sample.ts'),
      entries[scheduled.variant],
    ), {
      cwd: here,
      env: { ...process.env, NODE_ENV: 'production' },
    })
    if (child.exitCode !== 0)
      throw new Error(`Startup sample ${scheduled.pair}/${scheduled.variant} failed: ${child.stderr.toString().trim()}`)
    samples.push({
      ...scheduled,
      ...parseProcessSample(child.stdout.toString(), child.stderr.toString()),
    })
  }
  validateStartupSamples(samples, options.pairs)

  const sourceAfter = await readSourceSnapshot(repositoryRoot)
  if (sourceBefore.revision !== sourceAfter.revision || sourceBefore.fingerprint !== sourceAfter.fingerprint)
    throw new Error('Repository source changed during the startup benchmark')
  const graphsAfter = {
    root: await readBuiltGraph(entries.root, distRoot),
    runtime: await readBuiltGraph(entries.runtime, distRoot),
  }
  if (graphChanged(graphsBefore.root, graphsAfter.root) || graphChanged(graphsBefore.runtime, graphsAfter.runtime))
    throw new Error('Built router graph changed during the startup benchmark')

  const processors = cpus()
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    diagnosticReason: 'Fresh-process import comparison. Developer machines and hosted runners are not dedicated benchmark hardware.',
    generatedAt: new Date().toISOString(),
    runtime: {
      name: 'Bun',
      version: Bun.version,
      executable: process.execPath,
      requirement: runtimeRequirement,
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
    packages: packageProvenance,
    pairs: options.pairs,
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
  await runStartupBenchmark()
