import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { hostEnvironment } from '../routing/runtime'
import type { StartupSample } from './statistics'
import { parseStartupOptions, startupSampleCommand, startupSchedule } from './config'
import { prepareStartupContext, startupReportBase, verifyStartupContext } from './context'
import { parseProcessSample } from './sample-result'
import { summarizeStartupMetric, validateStartupSamples } from './statistics'

export async function runStartupBenchmark(args = process.argv.slice(2)): Promise<object> {
  const options = parseStartupOptions(args)
  const context = await prepareStartupContext(import.meta.dir)
  const samples: StartupSample[] = []

  for (const scheduled of startupSchedule(options.pairs)) {
    const child = Bun.spawnSync(startupSampleCommand(
      process.execPath,
      join(context.here, 'bunfig.toml'),
      join(context.here, 'sample.ts'),
      context.entries[scheduled.variant],
    ), {
      cwd: context.here,
      env: {
        ...hostEnvironment(),
        APP_ENV: 'production',
        NODE_ENV: 'production',
      },
    })
    if (child.exitCode !== 0)
      throw new Error(`Startup sample ${scheduled.pair}/${scheduled.variant} failed: ${child.stderr.toString().trim()}`)
    samples.push({
      ...scheduled,
      ...parseProcessSample(child.stdout.toString(), child.stderr.toString()),
    })
  }
  validateStartupSamples(samples, options.pairs)
  const verified = await verifyStartupContext(context)
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    diagnosticReason: 'Fresh-process import comparison. Developer machines and hosted runners are not dedicated benchmark hardware.',
    generatedAt: new Date().toISOString(),
    ...startupReportBase(context, verified),
    pairs: options.pairs,
    importMs: summarizeStartupMetric(samples, options.pairs, 'importMs'),
    rssBytes: summarizeStartupMetric(samples, options.pairs, 'rssBytes'),
    samples,
  }

  const output = resolve(context.repositoryRoot, options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

if (import.meta.main)
  await runStartupBenchmark()
