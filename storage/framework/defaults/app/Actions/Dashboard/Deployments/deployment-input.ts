export interface DeploymentCommandInput {
  environment?: unknown
  domain?: unknown
  dryRun?: unknown
}

export interface DeploymentRecordLike {
  get: (key: string) => unknown
}

export function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
}

export function deploymentCommandArgs(input: DeploymentCommandInput): string[] {
  const environment = String(input.environment || 'production').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environment))
    throw new Error('Environment must contain only letters, numbers, underscores, and hyphens.')

  const args = ['deploy', '--env', environment, '--no-interaction', '--yes']
  const domain = String(input.domain || '').trim().toLowerCase()
  if (domain) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))
      throw new Error('Domain must be a valid DNS name.')
    args.push('--domain', domain)
  }
  if (booleanValue(input.dryRun))
    args.push('--dry-run')
  return args
}

export function averageRecordedDuration(records: DeploymentRecordLike[]): number | null {
  const durations = records
    .map(record => record.get('duration'))
    .filter(duration => duration !== null && duration !== undefined && duration !== '')
    .map(duration => Number(duration))
    .filter(duration => Number.isFinite(duration) && duration >= 0)

  return durations.length > 0
    ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    : null
}

export function tailLines(content: string, limit = 250): string {
  if (limit <= 0)
    return ''
  return content.split(/\r?\n/).slice(-limit).join('\n')
}
