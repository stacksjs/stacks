import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type LifecycleReport = {
  revision?: string
  orchestratorRevision?: string | null
  status?: string
  installLifecycleExercised?: boolean
  runner?: { os?: string, arch?: string }
  artifacts?: Array<{ format?: string, sha256?: string }>
  steps?: Array<{ name?: string, status?: string }>
}

export function validateLifecycleReport(report: LifecycleReport, expected: {
  revision: string
  platform: string
  architecture: string
  formats: string[]
}): string[] {
  const errors: string[] = []
  if (report.revision !== expected.revision) errors.push(`Craft source revision mismatch: ${report.revision || 'missing'}`)
  if (report.status !== 'passed') errors.push(`Craft lifecycle status is ${report.status || 'missing'}`)
  if (report.installLifecycleExercised !== true) errors.push('privileged install lifecycle was not exercised')
  if (report.runner?.os !== expected.platform || report.runner?.arch !== expected.architecture)
    errors.push(`runner mismatch: ${report.runner?.os || 'missing'}/${report.runner?.arch || 'missing'}`)

  const steps = new Map((report.steps || []).map(step => [step.name, step.status]))
  for (const name of ['install v1', 'launch v1', 'update to v2', 'launch v2', 'rollback to v1', 'launch rollback', 'uninstall', 'verify uninstall']) {
    if (steps.get(name) !== 'passed') errors.push(`lifecycle step did not pass: ${name}`)
  }
  const artifacts = report.artifacts || []
  for (const format of expected.formats) {
    const matching = artifacts.filter(artifact => artifact.format === format)
    if (matching.length !== 2) errors.push(`expected two ${format} artifacts, found ${matching.length}`)
    if (matching.some(artifact => !/^[a-f0-9]{64}$/.test(artifact.sha256 || ''))) errors.push(`${format} artifact has an invalid digest`)
  }
  return errors
}

if (import.meta.main) {
  const value = (name: string): string => {
    const index = process.argv.indexOf(name)
    const result = index === -1 ? undefined : process.argv[index + 1]
    if (!result) throw new Error(`${name} requires a value`)
    return result
  }
  const reportPath = resolve(value('--report'))
  const outputPath = resolve(value('--output'))
  const expected = {
    revision: value('--revision'),
    platform: value('--platform'),
    architecture: value('--architecture'),
    formats: value('--formats').split(','),
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as LifecycleReport
  const errors = validateLifecycleReport(report, expected)
  if (errors.length) throw new Error(errors.join('\n'))
  const attestation = {
    schemaVersion: 1,
    status: 'passed',
    stacksRevision: process.env.GITHUB_SHA || 'local',
    craftRevision: expected.revision,
    sourceReport: reportPath,
    target: { platform: expected.platform, architecture: expected.architecture, formats: expected.formats },
    checks: { lifecycle: 'passed', artifactDigests: 'passed', sourcePin: 'passed' },
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(attestation, null, 2)}\n`)
  console.log(`Validated Craft lifecycle for ${expected.platform}/${expected.architecture}`)
}
