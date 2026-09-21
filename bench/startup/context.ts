import { arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { readRuntimeRequirement } from '../routing/runtime-version'
import type { BuiltGraph } from './graph'
import type { SourceSnapshot } from './provenance'
import { readBuiltGraph } from './graph'
import { readPackageProvenance, readSourceSnapshot } from './provenance'

export interface StartupEntries {
  root: string
  runtime: string
}

export interface StartupGraphs {
  root: BuiltGraph
  runtime: BuiltGraph
}

export interface StartupContext {
  entries: StartupEntries
  graphsBefore: StartupGraphs
  here: string
  packageProvenance: object
  repositoryRoot: string
  runtimeRequirement: { range: string, matches: boolean }
  sourceBefore: SourceSnapshot
}

export interface VerifiedStartupContext {
  graphsAfter: StartupGraphs
  sourceAfter: SourceSnapshot
}

export async function prepareStartupContext(here = import.meta.dir): Promise<StartupContext> {
  const repositoryRoot = resolve(here, '../..')
  const packageRoot = join(repositoryRoot, 'storage/framework/core/router')
  const distRoot = join(packageRoot, 'dist')
  const entries = {
    root: join(distRoot, 'index.js'),
    runtime: join(distRoot, 'runtime.js'),
  }
  const runtimeRequirement = await readRuntimeRequirement(repositoryRoot)
  if (!runtimeRequirement?.matches)
    throw new Error(`Bun ${Bun.version} does not satisfy the benchmark runtime requirement ${runtimeRequirement?.range ?? '(missing)'}`)

  return {
    here,
    repositoryRoot,
    entries,
    runtimeRequirement,
    sourceBefore: await readSourceSnapshot(repositoryRoot),
    graphsBefore: {
      root: await readBuiltGraph(entries.root, distRoot),
      runtime: await readBuiltGraph(entries.runtime, distRoot),
    },
    packageProvenance: await readPackageProvenance(packageRoot),
  }
}

export async function verifyStartupContext(context: StartupContext): Promise<VerifiedStartupContext> {
  const sourceAfter = await readSourceSnapshot(context.repositoryRoot)
  if (context.sourceBefore.revision !== sourceAfter.revision || context.sourceBefore.fingerprint !== sourceAfter.fingerprint)
    throw new Error('Repository source changed during the startup benchmark')
  const distRoot = dirname(context.entries.root)
  const graphsAfter = {
    root: await readBuiltGraph(context.entries.root, distRoot),
    runtime: await readBuiltGraph(context.entries.runtime, distRoot),
  }
  if (context.graphsBefore.root.digest !== graphsAfter.root.digest || context.graphsBefore.runtime.digest !== graphsAfter.runtime.digest)
    throw new Error('Built router graph changed during the startup benchmark')
  return { graphsAfter, sourceAfter }
}

export function startupReportBase(context: StartupContext, verified: VerifiedStartupContext): object {
  const processors = cpus()
  const rootGraph = context.graphsBefore.root
  const runtimeGraph = context.graphsBefore.runtime
  return {
    runtime: {
      name: 'Bun',
      version: Bun.version,
      executable: process.execPath,
      requirement: context.runtimeRequirement,
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
      before: context.sourceBefore,
      after: verified.sourceAfter,
      changedDuringRun: false,
    },
    packages: context.packageProvenance,
    entries: {
      root: relative(context.repositoryRoot, context.entries.root),
      runtime: relative(context.repositoryRoot, context.entries.runtime),
    },
    staticGraph: {
      root: rootGraph,
      runtime: runtimeGraph,
      fileCountDelta: runtimeGraph.fileCount - rootGraph.fileCount,
      byteDelta: runtimeGraph.totalBytes - rootGraph.totalBytes,
      bytePercentChange: ((runtimeGraph.totalBytes / rootGraph.totalBytes) - 1) * 100,
    },
  }
}
