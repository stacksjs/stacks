import process from 'node:process'

export interface DeploymentRollbackInput {
  environment: string
  site?: string
  release?: string
}

/**
 * The same input as a value the operations log can store.
 *
 * `JsonValue` has no room for `undefined`, so the optional fields are dropped
 * rather than recorded as absent-but-present keys.
 */
export function rollbackAuditPayload(input: DeploymentRollbackInput): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

export class DeploymentRollbackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeploymentRollbackError'
  }
}

function identifier(value: unknown, label: string, required = false): string {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized && !required) return ''
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(normalized))
    throw new DeploymentRollbackError(`${label} must contain only letters, numbers, dots, underscores, and hyphens.`)
  return normalized
}

export function deploymentRollbackInput(input: Record<string, unknown>): DeploymentRollbackInput {
  return {
    environment: identifier(input.environment || 'production', 'Environment', true),
    site: identifier(input.site, 'Site') || undefined,
    release: identifier(input.release || input.to, 'Release') || undefined,
  }
}

function commandArgs(input: DeploymentRollbackInput, preview: boolean): string[] {
  const args = ['deploy:rollback']
  if (input.site) args.push(input.site)
  args.push('--env', input.environment)
  if (input.release) args.push('--to', input.release)
  if (preview) args.push('--dry-run')
  args.push('--no-interaction')
  return args
}

function plainOutput(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '').trim()
}

async function run(input: DeploymentRollbackInput, preview: boolean): Promise<string> {
  const child = Bun.spawn([`${process.cwd()}/buddy`, ...commandArgs(input, preview)], {
    cwd: process.cwd(),
    env: { ...process.env, NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const output = plainOutput([stdout, stderr].filter(Boolean).join('\n'))
  if (exitCode !== 0)
    throw new DeploymentRollbackError(output || 'The rollback command failed.')
  return output
}

export async function previewDeploymentRollback(input: DeploymentRollbackInput) {
  const output = await run(input, true)
  const revision = new Bun.CryptoHasher('sha256').update(JSON.stringify(input)).update(output).digest('hex')
  return {
    revision,
    environment: input.environment,
    site: input.site || null,
    release: input.release || null,
    target: input.release || 'previous preserved release',
    output,
    warnings: [
      'The active release pointer and service runtime will change.',
      'Database migrations are not reversed automatically.',
    ],
  }
}

export async function executeDeploymentRollback(input: DeploymentRollbackInput, revision: string, confirmation: string) {
  const preview = await previewDeploymentRollback(input)
  if (preview.revision !== revision)
    throw new DeploymentRollbackError('The rollback preview changed. Review the current preview before continuing.')
  if (confirmation !== `rollback ${input.environment}`)
    throw new DeploymentRollbackError(`Type rollback ${input.environment} to confirm this recovery action.`)
  const output = await run(input, false)
  return { message: `Rollback for ${input.site || input.environment} completed.`, output }
}
