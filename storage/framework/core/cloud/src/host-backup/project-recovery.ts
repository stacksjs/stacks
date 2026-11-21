import type { BackupStatus } from './backup'

export const recoveryPointSeconds = 15 * 60

export function staleRecoveryProviders(status: BackupStatus, project: string, providers: readonly string[], now: number): string[] {
  return providers.filter((provider) => {
    const receipt = status.projects?.[project]?.[provider]
    if (!receipt || typeof receipt === 'string' || !receipt.restore_verified || !receipt.snapshot || receipt.databases !== 1)
      return true
    const source = receipt.source_timestamp
    return typeof source !== 'number' || !Number.isSafeInteger(source) || source > now || now - source > recoveryPointSeconds
  })
}
