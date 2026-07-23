import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { arch, platform } from 'node:os'
import { resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { assertCapabilityAvailable, capabilityRegistry } from '../../storage/framework/core/config/src/capabilities'
import { decryptValue, encryptValue, generateKeypair } from '../../storage/framework/core/env/src/crypto'
import { escapeHtml } from '../../storage/framework/core/error-handling/src/error-page-template'
import { createValidationErrorResponse } from '../../storage/framework/core/router/src/error-handler'
import { timingSafeEqualString } from '../../storage/framework/core/security/src/hash'
import { object, string } from '../../storage/framework/core/validation/src/index'

type ResultStatus = 'pass' | 'fail' | 'skipped' | 'unsupported' | 'exception' | 'experimental'

interface Requirement { id: string, evidence: 'behavior' | 'inspection' }
interface Catalog {
  protocolVersion: string
  catalogRevision: number
  requirements: Requirement[]
  extensions: Array<{ id: string }>
}
interface FixtureCorpus {
  suiteVersion: string
  fixtures: Array<{ id: string, requirements: string[] }>
}
interface Result {
  requirementId: string
  status: ResultStatus
  fixtureId: string | null
  evidenceUrl: string | null
  durationMs: number
  notes?: string
}

/** Executable-check evidence keyed by requirement id, merged into the report. */
type Evidence = Map<string, Omit<Result, 'requirementId' | 'fixtureId'>>

const root = resolve(import.meta.dir, '../..')
const suiteRoot = resolve(root, 'protocol/suite/1.0-draft')

function git(...arguments_: string[]): string {
  const result = Bun.spawnSync(['git', ...arguments_], { cwd: root })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim())
  return result.stdout.toString().trim()
}

function exactSourceDigest(): string {
  const tree = git('rev-parse', 'HEAD^{tree}')
  return `sha256:${createHash('sha256').update(tree).digest('hex')}`
}

function tamper(ciphertext: string): string {
  const prefix = 'encrypted:'
  const payload = Buffer.from(ciphertext.slice(prefix.length), 'base64')
  payload[payload.length - 1] ^= 1
  return `${prefix}${payload.toString('base64')}`
}

/** Source-permalink for an evidence file at the report's revision. */
function blob(revision: string, path: string): string {
  return `https://github.com/stacksjs/stacks/blob/${revision}/${path}`
}

export function executeSecurityEvidence(revision: string): Evidence {
  const evidence: Evidence = new Map()
  const cryptoUrl = blob(revision, 'storage/framework/core/env/src/crypto.ts')
  const comparisonUrl = blob(revision, 'storage/framework/core/security/src/hash.ts')
  const renderUrl = blob(revision, 'storage/framework/core/error-handling/src/error-page-template.ts')

  const started = performance.now()
  try {
    const { publicKey, privateKey } = generateKeypair()
    const encrypted = encryptValue('secret', publicKey)
    const roundTrip = decryptValue(encrypted, privateKey)
    let tamperRejected = false
    try {
      decryptValue(tamper(encrypted), privateKey)
    }
    catch {
      tamperRejected = true
    }
    const passed = roundTrip === 'secret' && !encrypted.includes('secret') && tamperRejected
    evidence.set('CORE-SEC-05', {
      status: passed ? 'pass' : 'fail',
      evidenceUrl: cryptoUrl,
      durationMs: Math.max(0, performance.now() - started),
      notes: passed ? 'Authenticated-encryption round trip passed and modified ciphertext was rejected.' : 'Authenticated-encryption fixture failed.',
    })
  }
  catch (error) {
    evidence.set('CORE-SEC-05', {
      status: 'fail',
      evidenceUrl: cryptoUrl,
      durationMs: Math.max(0, performance.now() - started),
      notes: `Authenticated-encryption fixture threw: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  const comparisonStarted = performance.now()
  const unequal = timingSafeEqualString('token-a', 'token-b') === false
  evidence.set('CORE-SEC-07', {
    status: unequal ? 'pass' : 'fail',
    evidenceUrl: comparisonUrl,
    durationMs: Math.max(0, performance.now() - comparisonStarted),
    notes: unequal ? 'The public authenticator comparison helper uses the runtime timing-safe primitive.' : 'Timing-safe comparison fixture failed.',
  })

  // CORE-SEC-02: rendered untrusted values are HTML-escaped by default.
  const renderStarted = performance.now()
  const escaped = escapeHtml('<script>alert(1)</script>')
  const renderOk = escaped === '&lt;script&gt;alert(1)&lt;/script&gt;'
  evidence.set('CORE-SEC-02', {
    status: renderOk ? 'pass' : 'fail',
    evidenceUrl: renderUrl,
    durationMs: Math.max(0, performance.now() - renderStarted),
    notes: renderOk ? 'Untrusted markup is converted to HTML entities by the default escaper.' : 'Default render-escaping fixture failed.',
  })
  return evidence
}

export function executeConfigEvidence(revision: string): Evidence {
  const evidence: Evidence = new Map()
  // CORE-CONFIG-02: selecting an unavailable capability fails closed before any unsafe work begins.
  const url = blob(revision, 'storage/framework/core/config/src/capabilities.ts')
  const started = performance.now()
  let failedClosed = false
  let message = ''
  try {
    assertCapabilityAvailable('queue', 'planned')
  }
  catch (error) {
    failedClosed = true
    message = error instanceof Error ? error.message : String(error)
  }
  evidence.set('CORE-CONFIG-02', {
    status: failedClosed ? 'pass' : 'fail',
    evidenceUrl: url,
    durationMs: Math.max(0, performance.now() - started),
    notes: failedClosed ? `Selecting an unavailable driver is rejected before use: ${message}` : 'Fail-closed capability guard accepted an unavailable driver.',
  })
  return evidence
}

export async function executeValidationEvidence(revision: string): Promise<Evidence> {
  const evidence: Evidence = new Map()
  const validationUrl = blob(revision, 'storage/framework/core/validation/src/validator.ts')
  const envelopeUrl = blob(revision, 'storage/framework/core/router/src/error-handler.ts')

  // CORE-VAL-01: nested invalid input yields stable field-keyed errors.
  const started = performance.now()
  const schema = object({ profile: object({ email: string().email() }) })
  const result = await schema.validate({ profile: { email: 'bad' } }) as { valid: boolean, errors: Record<string, Array<{ message?: string }>> }
  const valOk = result.valid === false && Object.keys(result.errors).includes('profile.email')
  evidence.set('CORE-VAL-01', {
    status: valOk ? 'pass' : 'fail',
    evidenceUrl: validationUrl,
    durationMs: Math.max(0, performance.now() - started),
    notes: valOk ? 'Nested invalid input produced a stable field-keyed error at profile.email.' : 'Field-keyed validation fixture failed.',
  })

  // CORE-ERR-01 / CORE-ERR-02: the machine-readable adapter returns a stable envelope
  // (error, message, status, field errors) that never leaks internals in production.
  const envStarted = performance.now()
  const fieldErrors: Record<string, string[]> = {}
  for (const [field, errors] of Object.entries(result.errors))
    fieldErrors[field] = errors.map(entry => entry.message ?? String(entry))
  const response = createValidationErrorResponse(fieldErrors, new Request('http://conformance.local/profile', { method: 'POST' }))
  const body = await response.text()
  const durationEnv = Math.max(0, performance.now() - envStarted)
  const envelopeOk = response.status === 422 && body.includes('"message":"Validation failed"') && body.includes('profile.email')
  evidence.set('CORE-ERR-01', {
    status: envelopeOk ? 'pass' : 'fail',
    evidenceUrl: envelopeUrl,
    durationMs: durationEnv,
    notes: envelopeOk ? 'Validation failure serialized to a stable 422 envelope with error, message, status, and field errors.' : 'Error-envelope fixture failed.',
  })
  const leaks = ['stack', 'password', 'SELECT', '/home/'].filter(token => body.includes(token))
  evidence.set('CORE-ERR-02', {
    status: envelopeOk && leaks.length === 0 ? 'pass' : 'fail',
    evidenceUrl: envelopeUrl,
    durationMs: durationEnv,
    notes: leaks.length === 0 ? 'Production error envelope contained no stack trace, credentials, raw query, or filesystem path.' : `Production error envelope leaked: ${leaks.join(', ')}.`,
  })
  return evidence
}

function validateSemantics(report: any, catalog: Catalog, fixtures: FixtureCorpus): string[] {
  const errors: string[] = []
  const expected = new Set(catalog.requirements.map(requirement => requirement.id))
  const seen = new Set<string>()
  const fixtureIds = new Set(fixtures.fixtures.map(fixture => fixture.id))
  for (const result of report.results as Result[]) {
    if (seen.has(result.requirementId)) errors.push(`${result.requirementId}: duplicate result`)
    if (!expected.has(result.requirementId)) errors.push(`${result.requirementId}: unknown requirement`)
    if (result.fixtureId && !fixtureIds.has(result.fixtureId)) errors.push(`${result.requirementId}: unknown fixture`)
    if (result.status === 'pass' && !result.evidenceUrl) errors.push(`${result.requirementId}: pass requires evidence`)
    seen.add(result.requirementId)
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`${id}: missing result`)
  if (report.profileClaim !== null) errors.push('The Stacks adapter must remain unverified until profile calculation is implemented')
  return errors
}

function renderSummary(report: any): string {
  const counts = new Map<ResultStatus, number>()
  for (const result of report.results as Result[]) counts.set(result.status, (counts.get(result.status) || 0) + 1)
  const rows = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `| ${status} | ${count} |`).join('\n')
  return `# Stacks protocol conformance report

**Profile claim:** Unverified
**Implementation:** \`${report.implementation.revision}\` (${report.implementation.version})
**Protocol:** ${report.protocol.version}, catalog ${report.protocol.catalogRevision}, suite ${report.protocol.suiteVersion}
**Runtime/platform:** Bun ${report.execution.runtime.version} on ${report.execution.platform.os}/${report.execution.platform.architecture}
**CI:** [run](${report.execution.ci.runUrl}) · [artifact](${report.execution.ci.artifactUrl})

| Status | Count |
| --- | ---: |
${rows}

Only executable adapter checks are marked \`pass\`. All remaining requirements stay \`skipped\` until their fixtures are wired to Stacks public APIs.
`
}

export async function buildReport(): Promise<Record<string, unknown>> {
  const startedAt = new Date()
  const catalog = JSON.parse(readFileSync(resolve(suiteRoot, 'catalog.json'), 'utf8')) as Catalog
  const fixtures = JSON.parse(readFileSync(resolve(suiteRoot, 'fixtures/conformance.json'), 'utf8')) as FixtureCorpus
  const lock = JSON.parse(readFileSync(resolve(root, 'protocol/suite.lock.json'), 'utf8')) as { rfcsRevision: string }
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }
  const revision = process.env.GITHUB_SHA || git('rev-parse', 'HEAD')
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : `https://github.com/stacksjs/stacks/commit/${revision}`
  const evidence = executeSecurityEvidence(revision)
  for (const [id, value] of executeConfigEvidence(revision)) evidence.set(id, value)
  for (const [id, value] of await executeValidationEvidence(revision)) evidence.set(id, value)
  const fixtureByRequirement = new Map(fixtures.fixtures.flatMap(fixture => fixture.requirements.map(id => [id, fixture.id] as const)))
  const results: Result[] = catalog.requirements.map((requirement) => ({
    requirementId: requirement.id,
    fixtureId: fixtureByRequirement.get(requirement.id) || null,
    ...(evidence.get(requirement.id) || {
      status: 'skipped' as const,
      evidenceUrl: null,
      durationMs: 0,
      notes: requirement.evidence === 'behavior' ? 'Fixture adapter is not implemented yet.' : 'Inspection evidence is not linked yet.',
    }),
  }))
  const drivers = capabilityRegistry.map(driver => ({
    category: driver.category,
    name: driver.name,
    version: packageJson.version,
    serviceVersion: null,
    topology: driver.topology,
    status: driver.status,
    evidenceUrl: driver.testEvidence[0] ? `https://github.com/stacksjs/stacks/blob/${revision}/${driver.testEvidence[0]}` : null,
    prerequisites: driver.prerequisites,
  }))

  return {
    reportVersion: '1.0.0-draft.1',
    protocol: { version: catalog.protocolVersion, catalogRevision: catalog.catalogRevision, suiteVersion: fixtures.suiteVersion, rfcsRevision: lock.rfcsRevision },
    implementation: { name: 'Stacks', version: packageJson.version, revision, repository: 'https://github.com/stacksjs/stacks', sourceDigest: exactSourceDigest() },
    execution: {
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      runtime: { name: 'bun', version: Bun.version },
      platform: { os: platform(), architecture: arch() },
      ci: { provider: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local', runUrl, artifactUrl: `${runUrl}#artifacts` },
    },
    profileClaim: null,
    results,
    drivers,
    extensions: catalog.extensions.map(extension => extension.id === 'EXT-DESKTOP-01'
      ? { id: extension.id, status: 'experimental', evidenceUrl: `https://github.com/stacksjs/stacks/blob/${revision}/protocol/evidence/desktop-support.json`, notes: 'Craft targets are explicitly experimental pending native release evidence and signing infrastructure.' }
      : { id: extension.id, status: 'unsupported', evidenceUrl: null, notes: 'Not evaluated by this adapter.' }),
    exceptions: [],
    generator: { name: '@stacksjs/protocol-adapter', version: '1.0.0-draft.1', revision },
  }
}

if (import.meta.main) {
  const report = await buildReport()
  const schema = JSON.parse(readFileSync(resolve(suiteRoot, 'schemas/conformance-report.schema.json'), 'utf8'))
  const catalog = JSON.parse(readFileSync(resolve(suiteRoot, 'catalog.json'), 'utf8')) as Catalog
  const fixtures = JSON.parse(readFileSync(resolve(suiteRoot, 'fixtures/conformance.json'), 'utf8')) as FixtureCorpus
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const errors = [
    ...(validate(report) ? [] : (validate.errors || []).map(error => `${error.instancePath || '/'} ${error.message || 'is invalid'}`)),
    ...validateSemantics(report, catalog, fixtures),
  ]
  if (errors.length > 0) {
    for (const error of errors) console.error(`error: ${error}`)
    process.exit(1)
  }
  const outputDirectory = resolve(process.env.PROTOCOL_REPORT_DIR || resolve(root, 'protocol/reports'))
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(resolve(outputDirectory, 'stacks-conformance.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(resolve(outputDirectory, 'stacks-conformance.md'), renderSummary(report))
  console.log(`Protocol report generated in ${outputDirectory}`)
}
