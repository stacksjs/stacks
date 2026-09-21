import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { hostEnvironment } from '../routing/runtime'
import { parseStartupOptions, startupSampleCommand, startupSchedule } from './config'
import { prepareStartupContext, startupReportBase, verifyStartupContext } from './context'
import type { ListenSample } from './listen-process'
import { measureListenProcess } from './listen-process'
import { summarizePairedMetric, validatePairedSamples } from './paired'

export async function runListenBenchmark(args = process.argv.slice(2)): Promise<object> {
  const options = parseStartupOptions(args, 'bench/startup/results/listen-latest.json')
  const context = await prepareStartupContext(import.meta.dir)
  const samples: ListenSample[] = []

  for (const scheduled of startupSchedule(options.pairs)) {
    const measurement = await measureListenProcess({
      command: startupSampleCommand(
        process.execPath,
        join(context.here, 'bunfig.toml'),
        join(context.here, 'listen-sample.ts'),
        context.entries[scheduled.variant],
      ),
      cwd: context.here,
      env: {
        ...hostEnvironment(),
        APP_ENV: 'production',
        NODE_ENV: 'production',
        STACKS_SECURITY_HEADERS_DISABLE: 'false',
      },
    })
    samples.push({ ...scheduled, ...measurement })
  }
  validatePairedSamples(samples, options.pairs)
  const verified = await verifyStartupContext(context)
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    diagnosticReason: 'Fresh-process spawn-to-ready comparison. Developer machines and hosted runners are not dedicated benchmark hardware.',
    generatedAt: new Date().toISOString(),
    ...startupReportBase(context, verified),
    pairs: options.pairs,
    listenMs: summarizePairedMetric(samples, options.pairs, 'listen time', sample => sample.listenMs),
    firstResponseMs: summarizePairedMetric(samples, options.pairs, 'first response time', sample => sample.firstResponseMs),
    rssBytes: summarizePairedMetric(samples, options.pairs, 'RSS value', sample => sample.rssBytes),
    samples,
  }

  const output = resolve(context.repositoryRoot, options.output)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  return result
}

if (import.meta.main)
  await runListenBenchmark()
