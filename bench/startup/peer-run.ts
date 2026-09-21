import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { resolvePeerVersions } from '../routing/peer-versions'
import { resolveStacksRuntimeDependencies, resolveStacksSourceModules } from '../routing/provenance'
import { headersFor, REPO_ROOT, serverCommand, serverEnvironment } from '../routing/runtime'
import { readRuntimeRequirement } from '../routing/runtime-version'
import { SCENARIOS } from '../routing/scenarios'
import { parsePeerStartupOptions, peerStartupSchedule } from './peer-config'
import { measureListenProcess } from './listen-process'
import type { PeerStartupSample } from './peer-statistics'
import { summarizePeerStartupMetric, validatePeerStartupSamples } from './peer-statistics'
import { readPackageProvenance, readSourceSnapshot } from './provenance'

export async function runPeerStartupBenchmark(args = process.argv.slice(2)): Promise<object> {
  const options = parsePeerStartupOptions(args)
  const runtimeRequirement = await readRuntimeRequirement(REPO_ROOT)
  if (!runtimeRequirement?.matches)
    throw new Error(`Bun ${Bun.version} does not satisfy the benchmark runtime requirement ${runtimeRequirement?.range ?? '(missing)'}`)
  const sourceBefore = await readSourceSnapshot(REPO_ROOT)
  const targetIds = options.targets.map(target => target.id)
  const peerVersions = await resolvePeerVersions(targetIds)
  if (Object.values(peerVersions).some(version => version === 'unavailable'))
    throw new Error('Every selected peer framework must resolve to an exact installed version')
  const samples: PeerStartupSample[] = []
  const scenario = SCENARIOS.find(candidate => candidate.id === 'static-json')!

  for (const scheduled of peerStartupSchedule(options.targets, options.runs)) {
    const measurement = await measureListenProcess({
      command: serverCommand(scheduled.target.server),
      cwd: REPO_ROOT,
      env: {
        ...serverEnvironment(scheduled.target, false, 'static-json'),
        BENCH_PORT: '0',
        BENCH_READY_HANDSHAKE: '1',
      },
      headers: headersFor(scheduled.target, scenario),
      path: '/bench/json',
      expectedBody: '{"hello":"world"}',
    })
    samples.push({
      run: scheduled.run,
      order: scheduled.order,
      targetId: scheduled.target.id,
      ...measurement,
    })
  }
  validatePeerStartupSamples(samples, options.runs, targetIds)
  const sourceAfter = await readSourceSnapshot(REPO_ROOT)
  if (sourceBefore.revision !== sourceAfter.revision || sourceBefore.fingerprint !== sourceAfter.fingerprint)
    throw new Error('Repository source changed during the peer startup benchmark')

  const processors = cpus()
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    diagnosticReason: 'Fresh-process peer readiness comparison. Developer machines and hosted runners are not dedicated benchmark hardware.',
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
    scenario: {
      id: 'static-json',
      method: 'GET',
      path: '/bench/json',
      expectedStatus: 200,
      expectedMediaType: 'application/json',
      expectedBodySha256: '93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588',
    },
    runs: options.runs,
    targets: options.targets,
    peerVersions,
    frameworkPackages: await readPackageProvenance(join(REPO_ROOT, 'storage/framework/core/router')),
    stacksSourceModules: resolveStacksSourceModules(REPO_ROOT),
    stacksRuntimeDependencies: resolveStacksRuntimeDependencies(REPO_ROOT),
    listenMs: summarizePeerStartupMetric(samples, options.runs, targetIds, 'listenMs'),
    firstResponseMs: summarizePeerStartupMetric(samples, options.runs, targetIds, 'firstResponseMs'),
    rssBytes: summarizePeerStartupMetric(samples, options.runs, targetIds, 'rssBytes'),
    samples,
  }

  const output = resolve(REPO_ROOT, options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

if (import.meta.main)
  await runPeerStartupBenchmark()
